// नमुना २५ - गुंतवणूक नोंदवही. गुंतवणूक केल्याची नोंद करताच cash_book_entries
// मध्ये खर्च नोंदते; परिपक्व/भरणा झाल्यावर "परिपक्व करा" कृतीने मिळालेली
// रक्कम जमा म्हणून नोंदते - दोन्ही वेळा रक्कम एकदाच टाईप करावी लागते.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  const where = [];
  const params = [];
  if (financialYearId) { where.push('i.financial_year_id = ?'); params.push(financialYearId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT i.*, lh.code AS head_code, lh.name AS head_name
     FROM investments i JOIN ledger_heads lh ON lh.id = i.ledger_head_id
     ${whereSql} ORDER BY i.investment_date DESC, i.id DESC`,
    params
  );
  res.json(rows);
});

router.post('/', requirePermission('investments', 'add'), async (req, res) => {
  const { financial_year_id, investment_date, description, purchase_price, maturity_date, matured_amount, ledger_head_id, remark } = req.body || {};
  if (!financial_year_id || !investment_date || !ledger_head_id) return res.status(400).json({ error: 'वर्ष, दिनांक व लेखाशीर्ष आवश्यक आहेत' });
  if (!description || !description.trim()) return res.status(400).json({ error: 'गुंतवणुकीचा तपशील आवश्यक आहे' });
  const price = Number(purchase_price);
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'रक्कम शून्यापेक्षा जास्त हवी' });

  const [[head]] = await pool.query('SELECT id, group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== 'खर्च') return res.status(400).json({ error: 'गुंतवणुकीसाठी खर्च गटातील लेखाशीर्ष निवडा' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cashResult] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'खर्च', 'मुख्य', ?, 'रोख', ?, ?)`,
      [financial_year_id, investment_date, ledger_head_id, price, `गुंतवणूक (नमुना २५) - ${description.trim()}`, req.user.id]
    );
    const [result] = await conn.query(
      `INSERT INTO investments
         (financial_year_id, investment_date, description, purchase_price, maturity_date, matured_amount, ledger_head_id, cash_book_entry_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [financial_year_id, investment_date, description.trim(), price, maturity_date || null, matured_amount ? Number(matured_amount) : null,
        ledger_head_id, cashResult.insertId, remark || null]
    );
    await conn.commit();
    const [[row]] = await pool.query(
      `SELECT i.*, lh.code AS head_code, lh.name AS head_name FROM investments i
       JOIN ledger_heads lh ON lh.id = i.ledger_head_id WHERE i.id = ?`,
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

router.post('/:id/mature', requirePermission('investments', 'edit'), async (req, res) => {
  const { matured_date, received_amount } = req.body || {};
  const amt = Number(received_amount);
  if (!matured_date || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'दिनांक व मिळालेली रक्कम आवश्यक आहेत' });

  const [[inv]] = await pool.query('SELECT * FROM investments WHERE id = ?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'नोंद सापडली नाही' });
  if (inv.is_matured) return res.status(400).json({ error: 'ही गुंतवणूक आधीच परिपक्व/भरणा झाली आहे' });

  // गुंतवणूक ज्या (खर्च) लेखाशीर्षाखाली केली त्याच गटाची जमा-बाजू शोधतो
  // (उदा. K4.2 ठेवी खर्च -> 4.2 ठेवी जमा) - कोड सारखाच, फक्त गट वेगळा.
  const [[investHead]] = await pool.query('SELECT code, name FROM ledger_heads WHERE id = ?', [inv.ledger_head_id]);
  const jamaCode = investHead.code.replace(/^K/, '');
  const [[jamaHead]] = await pool.query('SELECT id FROM ledger_heads WHERE code = ? AND group_type = ?', [jamaCode, 'जमा']);
  const targetHeadId = jamaHead ? jamaHead.id : inv.ledger_head_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cashResult] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'जमा', 'मुख्य', ?, 'रोख', ?, ?)`,
      [inv.financial_year_id, matured_date, targetHeadId, amt, `गुंतवणूक परिपक्वता (नमुना २५) - ${inv.description}`, req.user.id]
    );
    await conn.query(
      'UPDATE investments SET is_matured = 1, maturity_date = ?, matured_amount = ?, matured_cash_book_entry_id = ? WHERE id = ?',
      [matured_date, amt, cashResult.insertId, req.params.id]
    );
    await conn.commit();
    res.json({ ok: true, cash_book_entry_id: cashResult.insertId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
