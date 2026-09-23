// नमुना १७ - अग्रिम दिलेल्या/अनामत ठेवलेल्या रकमांची नोंदवही. मूळ रक्कम
// नोंदवताच cash_book_entries मध्ये एकच नोंद तयार होते (अग्रिम=खर्च,
// अनामत=जमा); परतफेड/समायोजन झाल्यावर तीच कृती (settle) उलट दिशेच्या
// रोख नोंदीसाठी वापरतात - रक्कम दुसऱ्यांदा नमुना ५ मध्ये टाईप करायची नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const KINDS = { 'अग्रिम': 'खर्च', 'अनामत': 'जमा' };

router.get('/', async (req, res) => {
  const { financialYearId, kind } = req.query;
  const where = [];
  const params = [];
  if (financialYearId) { where.push('e.financial_year_id = ?'); params.push(financialYearId); }
  if (kind && KINDS[kind]) { where.push('e.kind = ?'); params.push(kind); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT e.*, lh.code AS head_code, lh.name AS head_name
     FROM advance_deposit_entries e JOIN ledger_heads lh ON lh.id = e.ledger_head_id
     ${whereSql} ORDER BY e.entry_date DESC, e.id DESC`,
    params
  );
  const [settleRows] = await pool.query(
    `SELECT entry_id, COALESCE(SUM(amount), 0) AS settled FROM advance_deposit_settlements GROUP BY entry_id`
  );
  const settledByEntry = new Map(settleRows.map((r) => [r.entry_id, Number(r.settled)]));

  res.json(rows.map((r) => {
    const settled = settledByEntry.get(r.id) || 0;
    return { ...r, settled_amount: settled, balance: Number(r.amount) - settled, is_settled: settled >= Number(r.amount) };
  }));
});

router.get('/:id/settlements', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM advance_deposit_settlements WHERE entry_id = ? ORDER BY settlement_date, id',
    [req.params.id]
  );
  res.json(rows);
});

router.post('/', requirePermission('advance_deposits', 'add'), async (req, res) => {
  const { kind, party_name, description, financial_year_id, entry_date, ledger_head_id, amount, remark } = req.body || {};
  if (!KINDS[kind]) return res.status(400).json({ error: "kind 'अग्रिम' किंवा 'अनामत' असावा" });
  if (!party_name || !party_name.trim()) return res.status(400).json({ error: 'पक्षकाराचे नाव आवश्यक आहे' });
  if (!financial_year_id || !entry_date || !ledger_head_id) return res.status(400).json({ error: 'वर्ष, दिनांक व लेखाशीर्ष आवश्यक आहेत' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'रक्कम शून्यापेक्षा जास्त हवी' });

  const entryType = KINDS[kind];
  const [[head]] = await pool.query('SELECT id, group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== entryType) return res.status(400).json({ error: `${kind} साठी ${entryType} गटातील लेखाशीर्ष निवडा` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cashResult] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, ?, 'मुख्य', ?, 'रोख', ?, ?)`,
      [financial_year_id, entry_date, ledger_head_id, entryType, amt, `${kind} - ${party_name.trim()}${description ? ' - ' + description : ''}`, req.user.id]
    );
    const [result] = await conn.query(
      `INSERT INTO advance_deposit_entries
         (kind, party_name, description, financial_year_id, entry_date, ledger_head_id, amount, cash_book_entry_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [kind, party_name.trim(), description || null, financial_year_id, entry_date, ledger_head_id, amt, cashResult.insertId, remark || null]
    );
    await conn.commit();
    const [[row]] = await pool.query(
      `SELECT e.*, lh.code AS head_code, lh.name AS head_name FROM advance_deposit_entries e
       JOIN ledger_heads lh ON lh.id = e.ledger_head_id WHERE e.id = ?`,
      [result.insertId]
    );
    res.status(201).json(row);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// परतफेड/समायोजन - अग्रिम परत मिळाल्यास जमा, अनामत परत केल्यास खर्च
// (मूळ नोंदीच्या उलट दिशा). post_to_cashbook=false दिल्यास फक्त निव्वळ
// समायोजन नोंदते (रोख हालचाल नाही, उदा. बिलाविरुद्ध वळती).
router.post('/:id/settle', requirePermission('advance_deposits', 'edit'), async (req, res) => {
  const { settlement_date, amount, post_to_cashbook, note } = req.body || {};
  const amt = Number(amount);
  if (!settlement_date || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'दिनांक व रक्कम (शून्यापेक्षा जास्त) आवश्यक आहेत' });
  }
  const [[entry]] = await pool.query('SELECT * FROM advance_deposit_entries WHERE id = ?', [req.params.id]);
  if (!entry) return res.status(404).json({ error: 'नोंद सापडली नाही' });

  const [[settled]] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM advance_deposit_settlements WHERE entry_id = ?',
    [req.params.id]
  );
  const remaining = Number(entry.amount) - Number(settled.total);
  if (amt > remaining + 0.01) return res.status(400).json({ error: `शिल्लक रक्कम (${remaining.toFixed(2)}) पेक्षा जास्त भरता येत नाही` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let cashBookEntryId = null;
    if (post_to_cashbook !== false) {
      const oppositeType = KINDS[entry.kind] === 'खर्च' ? 'जमा' : 'खर्च';
      const [cashResult] = await conn.query(
        `INSERT INTO cash_book_entries
           (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
         VALUES (?, ?, ?, ?, 'मुख्य', ?, 'रोख', ?, ?)`,
        [entry.financial_year_id, settlement_date, entry.ledger_head_id, oppositeType, amt,
          `${entry.kind} परतफेड/समायोजन - ${entry.party_name}`, req.user.id]
      );
      cashBookEntryId = cashResult.insertId;
    }
    const [result] = await conn.query(
      `INSERT INTO advance_deposit_settlements (entry_id, settlement_date, amount, cash_book_entry_id, note)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, settlement_date, amt, cashBookEntryId, note || null]
    );
    await conn.commit();
    const [[row]] = await pool.query('SELECT * FROM advance_deposit_settlements WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
