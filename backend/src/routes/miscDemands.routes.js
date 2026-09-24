// नमुना ११ - किरकोळ मागणी नोंदवही. मागणी नोंदवल्यावर वसुली/सूट त्या मागणीवर
// नोंदतात; शिल्लक = रक्कम - वसुली - सूट (सर्व्हरवर मोजली, साठवत नाही). वसुली
// रोकड वहीत (नमुना ५) जमा म्हणून एकदाच पोस्ट होते (पावती क्र. = reference_no),
// सूट कोठेही पोस्ट होत नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

const DEMAND_SELECT = `
  SELECT d.id, d.financial_year_id, d.party_name, d.address, d.nature, d.authority, d.installment_count, d.amount,
         d.demand_no, DATE_FORMAT(d.demand_date, '%Y-%m-%d') AS demand_date, d.ledger_head_id, d.remark,
         lh.code AS head_code, lh.name AS head_name
  FROM misc_demands d JOIN ledger_heads lh ON lh.id = d.ledger_head_id`;

async function withEvents(demands) {
  const out = [];
  for (const d of demands) {
    const [events] = await pool.query(
      `SELECT id, kind, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date, amount, receipt_no, order_no, cash_book_entry_id
       FROM misc_demand_events WHERE demand_id = ? ORDER BY event_date, id`, [d.id]);
    const recovered = round2(events.filter((e) => e.kind === 'वसुली').reduce((s, e) => s + Number(e.amount), 0));
    const waived = round2(events.filter((e) => e.kind === 'सूट').reduce((s, e) => s + Number(e.amount), 0));
    out.push({ ...d, events, recovered_total: recovered, waived_total: waived, balance: round2(Number(d.amount) - recovered - waived) });
  }
  return out;
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  const [rows] = await pool.query(`${DEMAND_SELECT} ${financialYearId ? 'WHERE d.financial_year_id = ?' : ''} ORDER BY d.id DESC`, financialYearId ? [financialYearId] : []);
  res.json(await withEvents(rows));
});

router.post('/', requirePermission('misc_demands', 'add'), async (req, res) => {
  const b = req.body || {};
  if (!b.party_name || !b.party_name.trim()) return res.status(400).json({ error: 'नाव आवश्यक आहे' });
  if (!b.financial_year_id || !b.ledger_head_id) return res.status(400).json({ error: 'वर्ष व लेखाशीर्ष आवश्यक आहेत' });
  if (!(Number(b.amount) > 0)) return res.status(400).json({ error: 'मागणीची रक्कम शून्यापेक्षा जास्त हवी' });
  const [[head]] = await pool.query('SELECT group_type, is_leaf FROM ledger_heads WHERE id = ?', [b.ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== 'जमा') return res.status(400).json({ error: 'जमा गटातील लेखाशीर्ष निवडा' });
  const [r] = await pool.query(
    `INSERT INTO misc_demands (financial_year_id, party_name, address, nature, authority, installment_count, amount, demand_no, demand_date, ledger_head_id, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.financial_year_id, b.party_name.trim(), b.address || null, b.nature || null, b.authority || null,
      Number(b.installment_count) || 1, round2(Number(b.amount)), b.demand_no || null, b.demand_date || null, b.ledger_head_id, b.remark || null]
  );
  const [rows] = await pool.query(`${DEMAND_SELECT} WHERE d.id = ?`, [r.insertId]);
  res.status(201).json((await withEvents(rows))[0]);
});

router.post('/:id/events', requirePermission('misc_demands', 'edit'), async (req, res) => {
  const { kind, event_date, amount, receipt_no, order_no } = req.body || {};
  if (!['वसुली', 'सूट'].includes(kind)) return res.status(400).json({ error: 'प्रकार वसुली किंवा सूट हवा' });
  if (!event_date) return res.status(400).json({ error: 'दिनांक आवश्यक आहे' });
  const amt = round2(Number(amount));
  if (!(amt > 0)) return res.status(400).json({ error: 'रक्कम शून्यापेक्षा जास्त हवी' });
  const [rows] = await pool.query(`${DEMAND_SELECT} WHERE d.id = ?`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'मागणी सापडली नाही' });
  const [d] = await withEvents(rows);
  if (amt > d.balance) return res.status(400).json({ error: `रक्कम शिल्लकेपेक्षा (${d.balance.toFixed(2)}) जास्त आहे` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let cashId = null;
    if (kind === 'वसुली') {
      const [cash] = await conn.query(
        `INSERT INTO cash_book_entries
           (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, reference_no, reference_date, narration, created_by)
         VALUES (?, ?, ?, 'जमा', 'मुख्य', ?, 'रोख', ?, ?, ?, ?)`,
        [d.financial_year_id, event_date, d.ledger_head_id, amt, receipt_no || null, event_date,
          `किरकोळ मागणी वसुली (नमुना ११) - ${d.party_name}`, req.user.id]
      );
      cashId = cash.insertId;
    }
    await conn.query(
      'INSERT INTO misc_demand_events (demand_id, kind, event_date, amount, receipt_no, order_no, cash_book_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, kind, event_date, amt, receipt_no || null, order_no || null, cashId]
    );
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  const [again] = await pool.query(`${DEMAND_SELECT} WHERE d.id = ?`, [req.params.id]);
  res.status(201).json((await withEvents(again))[0]);
});

module.exports = router;
