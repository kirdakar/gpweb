const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { allocate, sumDue } = require('../utils/dueAllocation');
const { getDueBreakdownForProperty, getTotalPaid, getDueBreakdownBulk, getTotalPaidBulk } = require('../utils/dueBreakdown');

const router = express.Router();
router.use(requireAuth);

// कर जमा भरणे स्क्रीनसाठी: सध्याची देय रक्कम (जुनी+नविन, घटकनिहाय), आजवर
// भरलेली एकूण रक्कम, आणि त्यानुसार सध्याचे वाटप (paid/balance प्रत्येक
// घटकासाठी) - सर्व एकाच ठिकाणी.
router.get('/due-summary', async (req, res) => {
  const { propertyId, yearId } = req.query;
  if (!propertyId || !yearId) return res.status(400).json({ error: 'propertyId and yearId are required' });

  const { year, row } = await getDueBreakdownForProperty(pool, propertyId, yearId);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });
  if (!row) return res.status(404).json({ error: 'Property not found' });

  const totalPaid = await getTotalPaid(pool, propertyId);
  const totalDue = sumDue(row);
  const { paid, balance, unallocated } = allocate(row, totalPaid);

  const [history] = await pool.query(
    `SELECT p.*, fy.year_label FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     WHERE p.property_id = ? ORDER BY p.payment_date, p.id`,
    [propertyId]
  );

  res.json({
    property: row,
    year,
    total_due: totalDue,
    total_paid: totalPaid,
    balance_due: Math.max(0, totalDue - totalPaid),
    unallocated_advance: unallocated,
    paid_by_component: paid,
    balance_by_component: balance,
    history,
  });
});

// कर मागणी बिल (नमुना ९ क) "सर्व बिले एकदम तयार करा" साठी - due-summary
// चीच गणना (allocate) प्रत्येक मालमत्तेसाठी एकाच वेळी, हजारो HTTP रिक्वेस्ट
// टाळण्यासाठी. फक्त थकबाकी/चालू देय असलेल्या मालमत्ता परत करतो.
router.get('/due-summary-bulk', async (req, res) => {
  const { yearId } = req.query;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });

  const { year, rows } = await getDueBreakdownBulk(pool, yearId);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });

  const paidMap = await getTotalPaidBulk(pool, rows.map((r) => r.property_id));
  const summaries = rows.map((row) => {
    const totalPaid = paidMap[row.property_id] || 0;
    const { balance } = allocate(row, totalPaid);
    return { property: row, balance_by_component: balance };
  });

  res.json({ year, summaries });
});

router.get('/', async (req, res) => {
  const { propertyId } = req.query;
  const where = propertyId ? 'WHERE p.property_id = ?' : '';
  const params = propertyId ? [propertyId] : [];
  const [rows] = await pool.query(
    `SELECT p.*, fy.year_label, pm.owner_name, pm.property_code, pm.srno, pm.malmata_no
     FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     JOIN property_master pm ON pm.id = p.property_id
     ${where}
     ORDER BY p.payment_date DESC, p.id DESC`,
    params
  );
  res.json(rows);
});

// एका पावतीद्वारे नेमकी कोणती रक्कम (कोणत्या घटकात) वसूल झाली हे दाखवते:
// त्या पावतीच्या आधीपर्यंतचे एकूण वाटप वजा त्या पावतीसह एकूण वाटप.
async function computeReceiptAllocation(propertyId, yearId, paymentId) {
  const { row } = await getDueBreakdownForProperty(pool, propertyId, yearId);
  if (!row) return null;

  const [payments] = await pool.query(
    'SELECT id, amount FROM tax_payments WHERE property_id = ? ORDER BY payment_date, id',
    [propertyId]
  );

  let cumulativeBefore = 0;
  let thisAmount = 0;
  for (const p of payments) {
    if (p.id === Number(paymentId)) { thisAmount = Number(p.amount); break; }
    cumulativeBefore += Number(p.amount);
  }

  const before = allocate(row, cumulativeBefore);
  const after = allocate(row, cumulativeBefore + thisAmount);
  const coveredByThisReceipt = {};
  for (const key of Object.keys(after.paid)) {
    coveredByThisReceipt[key] = Math.round((after.paid[key] - before.paid[key]) * 100) / 100;
  }
  return { dues: row, coveredByThisReceipt, balanceAfter: after.balance, amount: thisAmount };
}

router.get('/:id/receipt', async (req, res) => {
  const [[payment]] = await pool.query(
    `SELECT p.*, fy.year_label FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const alloc = await computeReceiptAllocation(payment.property_id, payment.financial_year_id, payment.id);
  res.json({ payment, ...alloc });
});

router.post('/', requirePermission('payments', 'add'), async (req, res) => {
  const { property_id, financial_year_id, payment_date, amount, narration } = req.body || {};
  if (!property_id || !financial_year_id || !payment_date) {
    return res.status(400).json({ error: 'property_id, financial_year_id and payment_date are required' });
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const [[property]] = await pool.query('SELECT id FROM property_master WHERE id = ?', [property_id]);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const [result] = await pool.query(
    `INSERT INTO tax_payments (property_id, financial_year_id, payment_date, amount, narration, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [property_id, financial_year_id, payment_date, amt, narration || null, req.user.id]
  );

  const alloc = await computeReceiptAllocation(property_id, financial_year_id, result.insertId);
  const [[payment]] = await pool.query(
    `SELECT p.*, fy.year_label FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     WHERE p.id = ?`,
    [result.insertId]
  );

  res.status(201).json({ payment, ...alloc });
});

router.delete('/:id', requirePermission('payments', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM tax_payments WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
