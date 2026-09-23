// नमुना २९ - कर्जाची नोंदवही. कर्ज मिळाल्याची नोंद करताच cash_book_entries
// मध्ये जमा नोंदते; प्रत्येक हप्ता भरताना "हप्ता भरा" कृतीने खर्च नोंदते -
// रक्कम दुसऱ्यांदा नमुना ५ मध्ये टाईप करायची नाही.
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
  if (financialYearId) { where.push('l.financial_year_id = ?'); params.push(financialYearId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT l.*, lh.code AS head_code, lh.name AS head_name
     FROM loans l JOIN ledger_heads lh ON lh.id = l.ledger_head_id
     ${whereSql} ORDER BY l.received_date DESC, l.id DESC`,
    params
  );
  const [repayRows] = await pool.query(
    `SELECT loan_id, COALESCE(SUM(principal_amount), 0) AS principal_paid, COALESCE(SUM(interest_amount), 0) AS interest_paid
     FROM loan_repayments GROUP BY loan_id`
  );
  const repayByLoan = new Map(repayRows.map((r) => [r.loan_id, r]));

  res.json(rows.map((l) => {
    const repay = repayByLoan.get(l.id) || { principal_paid: 0, interest_paid: 0 };
    return {
      ...l,
      principal_paid: Number(repay.principal_paid),
      interest_paid: Number(repay.interest_paid),
      balance: Number(l.loan_amount) - Number(repay.principal_paid),
    };
  }));
});

router.get('/:id/repayments', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY repayment_date, id', [req.params.id]);
  res.json(rows);
});

router.post('/', requirePermission('loans', 'add'), async (req, res) => {
  const { financial_year_id, source, sanction_order_no, sanction_date, purpose, loan_amount, interest_rate, received_date, ledger_head_id, remark } = req.body || {};
  if (!financial_year_id || !received_date || !ledger_head_id) return res.status(400).json({ error: 'वर्ष, कर्ज मिळाल्याची तारीख व लेखाशीर्ष आवश्यक आहेत' });
  if (!source || !source.trim()) return res.status(400).json({ error: 'कर्जाची उभारणीचे साधन आवश्यक आहे' });
  const amt = Number(loan_amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'कर्जाची रक्कम शून्यापेक्षा जास्त हवी' });

  const [[head]] = await pool.query('SELECT id, group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== 'जमा') return res.status(400).json({ error: 'कर्ज मिळाल्यासाठी जमा गटातील लेखाशीर्ष निवडा' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cashResult] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'जमा', 'मुख्य', ?, 'रोख', ?, ?)`,
      [financial_year_id, received_date, ledger_head_id, amt, `कर्ज मिळाले (नमुना २९) - ${source.trim()}`, req.user.id]
    );
    const [result] = await conn.query(
      `INSERT INTO loans
         (financial_year_id, source, sanction_order_no, sanction_date, purpose, loan_amount, interest_rate, received_date, ledger_head_id, cash_book_entry_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [financial_year_id, source.trim(), sanction_order_no || null, sanction_date || null, purpose || null, amt,
        interest_rate ? Number(interest_rate) : null, received_date, ledger_head_id, cashResult.insertId, remark || null]
    );
    await conn.commit();
    const [[row]] = await pool.query(
      `SELECT l.*, lh.code AS head_code, lh.name AS head_name FROM loans l
       JOIN ledger_heads lh ON lh.id = l.ledger_head_id WHERE l.id = ?`,
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

router.post('/:id/repay', requirePermission('loans', 'edit'), async (req, res) => {
  const { repayment_date, principal_amount, interest_amount } = req.body || {};
  const principal = Number(principal_amount) || 0;
  const interest = Number(interest_amount) || 0;
  if (!repayment_date || (principal <= 0 && interest <= 0)) {
    return res.status(400).json({ error: 'दिनांक व मुद्दल किंवा व्याज रक्कम आवश्यक आहे' });
  }
  const [[loan]] = await pool.query('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!loan) return res.status(404).json({ error: 'कर्ज सापडले नाही' });

  const [[paid]] = await pool.query('SELECT COALESCE(SUM(principal_amount), 0) AS total FROM loan_repayments WHERE loan_id = ?', [req.params.id]);
  const remaining = Number(loan.loan_amount) - Number(paid.total);
  if (principal > remaining + 0.01) return res.status(400).json({ error: `शिल्लक मुद्दल (${remaining.toFixed(2)}) पेक्षा जास्त भरता येत नाही` });

  // कर्ज मिळाले त्याच गटाची खर्च-बाजू शोधतो (उदा. 4.3 कर्जे जमा -> K4.3 कर्जे, हप्ता व व्याज प्रदाने खर्च).
  const [[loanHead]] = await pool.query('SELECT code FROM ledger_heads WHERE id = ?', [loan.ledger_head_id]);
  const [[kharchHead]] = await pool.query('SELECT id FROM ledger_heads WHERE code = ? AND group_type = ?', [`K${loanHead.code}`, 'खर्च']);
  const targetHeadId = kharchHead ? kharchHead.id : loan.ledger_head_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cashResult] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'खर्च', 'मुख्य', ?, 'रोख', ?, ?)`,
      [loan.financial_year_id, repayment_date, targetHeadId, principal + interest, `कर्ज हप्ता परतफेड (नमुना २९) - ${loan.source}`, req.user.id]
    );
    const [result] = await conn.query(
      `INSERT INTO loan_repayments (loan_id, repayment_date, principal_amount, interest_amount, cash_book_entry_id)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, repayment_date, principal, interest, cashResult.insertId]
    );
    await conn.commit();
    const [[row]] = await pool.query('SELECT * FROM loan_repayments WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
