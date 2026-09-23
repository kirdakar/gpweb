// नमुना १ - वार्षिक अंदाजपत्रक. प्रत्येक leaf लेखाशीर्षासाठी प्रस्तावित/मंजूर
// रक्कम (budget_entries) साठवतो; मागील वर्ष/गतपूर्व वर्षाची प्रत्यक्ष रक्कम
// (कागदी नमुन्याचे कॉलम ४/५) cash_book_entries वरून काढलेली आहे, साठवलेली
// नाही - years.routes.js च्या carry-forward लॉजिकमधलाच "मागील वर्ष"
// (year_label वर स्ट्रिंग तुलना) शोध वापरतो.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

async function findPriorYear(yearLabel) {
  const [[row]] = await pool.query(
    'SELECT id, year_label FROM financial_years WHERE year_label < ? ORDER BY year_label DESC LIMIT 1',
    [yearLabel]
  );
  return row || null;
}

async function actualsFor(yearRow) {
  if (!yearRow) return new Map();
  const [rows] = await pool.query(
    'SELECT ledger_head_id, SUM(amount) AS total FROM cash_book_entries WHERE financial_year_id = ? GROUP BY ledger_head_id',
    [yearRow.id]
  );
  return new Map(rows.map((r) => [r.ledger_head_id, Number(r.total)]));
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  if (!financialYearId) return res.status(400).json({ error: 'financialYearId is required' });

  const [[year]] = await pool.query('SELECT id, year_label FROM financial_years WHERE id = ?', [financialYearId]);
  if (!year) return res.status(404).json({ error: 'आर्थिक वर्ष सापडले नाही' });

  const previousYear = await findPriorYear(year.year_label);
  const yearBeforePrevious = previousYear ? await findPriorYear(previousYear.year_label) : null;

  const [heads] = await pool.query(
    'SELECT id, code, group_type, parent_id, name, sort_order, is_leaf FROM ledger_heads ORDER BY group_type, sort_order'
  );
  const [budgetRows] = await pool.query(
    'SELECT ledger_head_id, proposed_amount, approved_amount FROM budget_entries WHERE financial_year_id = ?',
    [financialYearId]
  );
  const budgetByHead = new Map(budgetRows.map((r) => [r.ledger_head_id, r]));

  const [previousActuals, yearBeforeActuals] = await Promise.all([
    actualsFor(previousYear),
    actualsFor(yearBeforePrevious),
  ]);

  const heads_ = heads.map((h) => ({
    ...h,
    proposed_amount: Number(budgetByHead.get(h.id)?.proposed_amount ?? 0),
    approved_amount: Number(budgetByHead.get(h.id)?.approved_amount ?? 0),
    previous_year_actual: previousActuals.get(h.id) ?? 0,
    year_before_previous_actual: yearBeforeActuals.get(h.id) ?? 0,
  }));

  res.json({ year, previous_year: previousYear, year_before_previous: yearBeforePrevious, heads: heads_ });
});

router.put('/', requirePermission('budget_entries', 'edit'), async (req, res) => {
  const { financial_year_id, entries } = req.body || {};
  if (!financial_year_id || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'financial_year_id व entries (यादी) आवश्यक आहेत' });
  }

  const [leaves] = await pool.query('SELECT id FROM ledger_heads WHERE is_leaf = 1');
  const validIds = new Set(leaves.map((l) => l.id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      const headId = Number(e.ledger_head_id);
      if (!validIds.has(headId)) continue;
      await conn.query(
        `INSERT INTO budget_entries (financial_year_id, ledger_head_id, proposed_amount, approved_amount)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE proposed_amount = VALUES(proposed_amount), approved_amount = VALUES(approved_amount)`,
        [financial_year_id, headId, Number(e.proposed_amount) || 0, Number(e.approved_amount) || 0]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
