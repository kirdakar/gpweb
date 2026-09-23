// नमुना ५ - दैनिक रोकड वही. प्रत्येक जमा/खर्च व्यवहार इथे नोंदतो; नमुना ६
// (वर्गीकृत नोंदवही) हा याच नोंदींवरून काढलेला रिपोर्ट आहे (पहा
// reports.routes.js), वेगळा साठा नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const PAYMENT_MODES = ['रोख', 'धनादेश'];
const ENTRY_TYPES = ['जमा', 'खर्च'];

router.get('/', async (req, res) => {
  const { financialYearId, from, to, entryType } = req.query;
  const where = [];
  const params = [];
  if (financialYearId) { where.push('c.financial_year_id = ?'); params.push(financialYearId); }
  if (from) { where.push('c.entry_date >= ?'); params.push(from); }
  if (to) { where.push('c.entry_date <= ?'); params.push(to); }
  if (entryType) { where.push('c.entry_type = ?'); params.push(entryType); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c
     JOIN ledger_heads lh ON lh.id = c.ledger_head_id
     ${whereSql}
     ORDER BY c.entry_date, c.id`,
    params
  );
  res.json(rows);
});

router.post('/', requirePermission('cash_book', 'add'), async (req, res) => {
  const {
    financial_year_id, entry_date, ledger_head_id, entry_type, amount,
    payment_mode, reference_no, reference_date, bank_deposit_date, narration,
  } = req.body || {};

  if (!financial_year_id || !entry_date || !ledger_head_id || !entry_type || !amount) {
    return res.status(400).json({ error: 'वर्ष, दिनांक, लेखाशीर्ष, प्रकार व रक्कम आवश्यक आहेत' });
  }
  if (!ENTRY_TYPES.includes(entry_type)) return res.status(400).json({ error: "entry_type 'जमा' किंवा 'खर्च' असावा" });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'रक्कम शून्यापेक्षा जास्त हवी' });
  const mode = PAYMENT_MODES.includes(payment_mode) ? payment_mode : 'रोख';

  const [[head]] = await pool.query('SELECT id, group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== entry_type) return res.status(400).json({ error: 'निवडलेले लेखाशीर्ष या प्रकाराशी (जमा/खर्च) जुळत नाही' });

  const [result] = await pool.query(
    `INSERT INTO cash_book_entries
       (financial_year_id, entry_date, ledger_head_id, entry_type, amount, payment_mode,
        reference_no, reference_date, bank_deposit_date, narration, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [financial_year_id, entry_date, ledger_head_id, entry_type, amt, mode,
      reference_no || null, reference_date || null, bank_deposit_date || null, narration || null, req.user.id]
  );
  const [[row]] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c JOIN ledger_heads lh ON lh.id = c.ledger_head_id WHERE c.id = ?`,
    [result.insertId]
  );
  res.status(201).json(row);
});

router.delete('/:id', requirePermission('cash_book', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM cash_book_entries WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
