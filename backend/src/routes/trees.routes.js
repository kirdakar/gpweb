// नमुना ३३ - वृक्ष नोंदवही. "प्रत्यक्ष प्राप्त उत्पन्न" हे tree_income नोंदींची बेरीज
// आहे (साठवलेले नाही); प्रत्येक उत्पन्न नोंद रोकड वहीत जमा म्हणून एकदाच पोस्ट होते.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

const TREE_SELECT = `
  SELECT t.id, t.location_detail, t.tree_type, t.info, t.tree_count, t.expected_annual_income,
         DATE_FORMAT(t.disposal_date, '%Y-%m-%d') AS disposal_date, t.disposal_details
  FROM trees t`;

async function withIncome(trees) {
  const out = [];
  for (const t of trees) {
    const [inc] = await pool.query(
      `SELECT i.id, i.financial_year_id, DATE_FORMAT(i.income_date, '%Y-%m-%d') AS income_date, i.amount, i.remark, lh.code AS head_code
       FROM tree_income i JOIN ledger_heads lh ON lh.id = i.ledger_head_id WHERE i.tree_id = ? ORDER BY i.income_date, i.id`, [t.id]);
    out.push({ ...t, income: inc, actual_income_total: round2(inc.reduce((s, i) => s + Number(i.amount), 0)) });
  }
  return out;
}

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`${TREE_SELECT} ORDER BY t.id DESC`);
  res.json(await withIncome(rows));
});

function validate(b) {
  if (!b.location_detail || !b.location_detail.trim()) return 'जमिनीचा/रस्त्याचा तपशील आवश्यक आहे';
  if (!b.tree_type || !b.tree_type.trim()) return 'वृक्षाचा प्रकार आवश्यक आहे';
  if (!(Number(b.tree_count) >= 0)) return 'वृक्षांची संख्या योग्य नाही';
  return null;
}

router.post('/', requirePermission('trees', 'add'), async (req, res) => {
  const b = req.body || {};
  const err = validate(b);
  if (err) return res.status(400).json({ error: err });
  const [r] = await pool.query(
    'INSERT INTO trees (location_detail, tree_type, info, tree_count, expected_annual_income) VALUES (?, ?, ?, ?, ?)',
    [b.location_detail.trim(), b.tree_type.trim(), b.info || null, Number(b.tree_count) || 0, Number(b.expected_annual_income) || 0]
  );
  const [rows] = await pool.query(`${TREE_SELECT} WHERE t.id = ?`, [r.insertId]);
  res.status(201).json((await withIncome(rows))[0]);
});

router.put('/:id', requirePermission('trees', 'edit'), async (req, res) => {
  const b = req.body || {};
  const err = validate(b);
  if (err) return res.status(400).json({ error: err });
  const [r] = await pool.query(
    `UPDATE trees SET location_detail = ?, tree_type = ?, info = ?, tree_count = ?, expected_annual_income = ?,
       disposal_date = ?, disposal_details = ? WHERE id = ?`,
    [b.location_detail.trim(), b.tree_type.trim(), b.info || null, Number(b.tree_count) || 0, Number(b.expected_annual_income) || 0,
      b.disposal_date || null, b.disposal_details || null, req.params.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  const [rows] = await pool.query(`${TREE_SELECT} WHERE t.id = ?`, [req.params.id]);
  res.json((await withIncome(rows))[0]);
});

router.delete('/:id', requirePermission('trees', 'delete'), async (req, res) => {
  const [[u]] = await pool.query('SELECT COUNT(*) AS n FROM tree_income WHERE tree_id = ?', [req.params.id]);
  if (u.n > 0) return res.status(400).json({ error: 'उत्पन्न नोंदलेले आहे (रोकड वहीत पोस्ट) - मिटवता येणार नाही' });
  await pool.query('DELETE FROM trees WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/income', requirePermission('trees', 'edit'), async (req, res) => {
  const { financial_year_id, income_date, amount, ledger_head_id, remark } = req.body || {};
  if (!financial_year_id || !income_date || !ledger_head_id) return res.status(400).json({ error: 'वर्ष, दिनांक व लेखाशीर्ष आवश्यक आहेत' });
  const amt = round2(Number(amount));
  if (!(amt > 0)) return res.status(400).json({ error: 'रक्कम शून्यापेक्षा जास्त हवी' });
  const [[tree]] = await pool.query('SELECT id, tree_type, location_detail FROM trees WHERE id = ?', [req.params.id]);
  if (!tree) return res.status(404).json({ error: 'वृक्ष नोंद सापडली नाही' });
  const [[head]] = await pool.query('SELECT group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== 'जमा') return res.status(400).json({ error: 'जमा गटातील लेखाशीर्ष निवडा' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cash] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'जमा', 'मुख्य', ?, 'रोख', ?, ?)`,
      [financial_year_id, income_date, ledger_head_id, amt, `वृक्ष उत्पन्न (नमुना ३३) - ${tree.tree_type}, ${tree.location_detail}`, req.user.id]
    );
    await conn.query(
      'INSERT INTO tree_income (tree_id, financial_year_id, income_date, amount, ledger_head_id, cash_book_entry_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, financial_year_id, income_date, amt, ledger_head_id, cash.insertId, remark || null]
    );
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  const [rows] = await pool.query(`${TREE_SELECT} WHERE t.id = ?`, [req.params.id]);
  res.status(201).json((await withIncome(rows))[0]);
});

module.exports = router;
