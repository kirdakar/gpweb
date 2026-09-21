const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { allocate, sumDue, round2, GROUP_ORDER_BY_TYPE, GHARPATTI_GROUP_ORDER, PANIPATTI_GROUP_ORDER } = require('../utils/dueAllocation');
const {
  getDueBreakdownForProperty, getTotalPaid, getDueBreakdownBulk, getTotalPaidBulk, getCombinedAllocation,
} = require('../utils/dueBreakdown');

const router = express.Router();
router.use(requireAuth);

const RECEIPT_TYPES = ['gharpatti', 'panipatti'];
function assertReceiptType(t) {
  if (!RECEIPT_TYPES.includes(t)) {
    const err = new Error("receiptType must be 'gharpatti' or 'panipatti'");
    err.status = 400;
    throw err;
  }
}

// कर जमा भरणे स्क्रीनसाठी: निवडलेल्या पावती-प्रकाराची (घरपट्टी किंवा
// पाणीपट्टी) देय रक्कम (जुनी+नविन, घटकनिहाय), त्याच प्रकारच्या पावत्यांतून
// आजवर भरलेली एकूण रक्कम, आणि त्यानुसार वाटप - दोन्ही पावती-मालिका आता
// स्वतंत्र असल्याने प्रत्येकीचे FIFO वाटप एकमेकांपासून वेगळे मोजते.
//
// receiptType न दिल्यास (उदा. नमुना ९ क - कर मागणी बिल, जे घरपट्टी+पाणीपट्टी
// दोन्ही एकत्र दाखवते, पावती नव्हे) दोन्ही गट combine करून जुन्याच 8-key
// आकारात (backward compatible) परत करतो.
router.get('/due-summary', async (req, res) => {
  const { propertyId, yearId, receiptType } = req.query;
  if (!propertyId || !yearId) {
    return res.status(400).json({ error: 'propertyId and yearId are required' });
  }
  if (receiptType) assertReceiptType(receiptType);
  const order = receiptType ? GROUP_ORDER_BY_TYPE[receiptType] : null;

  const { year, row } = await getDueBreakdownForProperty(pool, propertyId, yearId);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });
  if (!row) return res.status(404).json({ error: 'Property not found' });

  if (!receiptType) {
    const { paid, balance, unallocated } = await getCombinedAllocation(pool, propertyId, row);
    const totalPaid = await getTotalPaid(pool, propertyId);
    const totalDue = sumDue(row);
    const [history] = await pool.query(
      `SELECT p.*, fy.year_label FROM tax_payments p
       JOIN financial_years fy ON fy.id = p.financial_year_id
       WHERE p.property_id = ? ORDER BY p.payment_date, p.id`,
      [propertyId]
    );
    return res.json({
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
  }

  const totalPaid = await getTotalPaid(pool, propertyId, receiptType);
  const totalDue = sumDue(row, order);
  const { paid, balance, unallocated } = allocate(row, totalPaid, order);

  const [history] = await pool.query(
    `SELECT p.*, fy.year_label FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     WHERE p.property_id = ? AND p.receipt_type = ? ORDER BY p.payment_date, p.id`,
    [propertyId, receiptType]
  );

  res.json({
    property: row,
    year,
    receipt_type: receiptType,
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
// टाळण्यासाठी. फक्त थकबाकी/चालू देय असलेल्या मालमत्ता परत करतो. हे बिल
// (मागणी नोटीस, पावती नव्हे) घरपट्टी+पाणीपट्टी दोन्ही एकत्र दाखवते, त्यामुळे
// दोन्ही गटांचे स्वतंत्र वाटप एकत्र (combine) करून जुन्याच 8-key आकारात देतो.
router.get('/due-summary-bulk', async (req, res) => {
  const { yearId } = req.query;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });

  const { year, rows } = await getDueBreakdownBulk(pool, yearId);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });

  const propertyIds = rows.map((r) => r.property_id);
  const [paidMapG, paidMapP] = await Promise.all([
    getTotalPaidBulk(pool, propertyIds, 'gharpatti'),
    getTotalPaidBulk(pool, propertyIds, 'panipatti'),
  ]);
  const summaries = rows.map((row) => {
    const { balance } = getCombinedAllocationSync(row, paidMapG[row.property_id] || 0, paidMapP[row.property_id] || 0);
    return { property: row, balance_by_component: balance };
  });

  res.json({ year, summaries });
});

// getCombinedAllocation (dueBreakdown.js) स्वतःच totalPaid आणते (DB कॉल) -
// इथे bulk साठी आधीच आणलेले totals वापरायचे असल्याने समकालिक (sync) आवृत्ती.
function getCombinedAllocationSync(dues, totalPaidGharpatti, totalPaidPanipatti) {
  const gAlloc = allocate(dues, totalPaidGharpatti, GHARPATTI_GROUP_ORDER);
  const pAlloc = allocate(dues, totalPaidPanipatti, PANIPATTI_GROUP_ORDER);
  return {
    paid: { ...gAlloc.paid, ...pAlloc.paid },
    balance: { ...gAlloc.balance, ...pAlloc.balance },
    unallocated: { gharpatti: gAlloc.unallocated, panipatti: pAlloc.unallocated },
  };
}

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
// त्या पावतीच्या आधीपर्यंतचे (त्याच receipt_type च्या पावत्यांचे) एकूण
// वाटप वजा त्या पावतीसह एकूण वाटप - फक्त त्या receipt_type च्या
// पावत्यांच्या cumulative रकमेवर, दुसऱ्या गटाच्या पावत्या न मोजता.
async function computeReceiptAllocation(propertyId, yearId, paymentId, receiptType) {
  const { row } = await getDueBreakdownForProperty(pool, propertyId, yearId);
  if (!row) return null;
  const order = GROUP_ORDER_BY_TYPE[receiptType];

  const [payments] = await pool.query(
    'SELECT id, amount FROM tax_payments WHERE property_id = ? AND receipt_type = ? ORDER BY payment_date, id',
    [propertyId, receiptType]
  );

  let cumulativeBefore = 0;
  let thisAmount = 0;
  for (const p of payments) {
    if (p.id === Number(paymentId)) { thisAmount = Number(p.amount); break; }
    cumulativeBefore += Number(p.amount);
  }

  const before = allocate(row, cumulativeBefore, order);
  const after = allocate(row, cumulativeBefore + thisAmount, order);
  const coveredByThisReceipt = {};
  for (const key of Object.keys(after.paid)) {
    coveredByThisReceipt[key] = round2(after.paid[key] - before.paid[key]);
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

  const alloc = await computeReceiptAllocation(payment.property_id, payment.financial_year_id, payment.id, payment.receipt_type);
  res.json({ payment, ...alloc });
});

router.post('/', requirePermission('payments', 'add'), async (req, res) => {
  const {
    property_id, financial_year_id, payment_date, amount, narration, receipt_type,
    khuli_jaga_amount, notice_fee_amount, warrant_fee_amount, other_amount,
  } = req.body || {};
  if (!property_id || !financial_year_id || !payment_date || !receipt_type) {
    return res.status(400).json({ error: 'property_id, financial_year_id, payment_date and receipt_type are required' });
  }
  assertReceiptType(receipt_type);

  const amt = round2(amount || 0);
  const khuliJaga = round2(khuli_jaga_amount || 0);
  const noticeFee = round2(notice_fee_amount || 0);
  const warrantFee = round2(warrant_fee_amount || 0);
  const other = round2(other_amount || 0);
  if (amt < 0 || khuliJaga < 0 || noticeFee < 0 || warrantFee < 0 || other < 0) {
    return res.status(400).json({ error: 'रकमा ऋण (negative) असू शकत नाहीत' });
  }
  if (amt + khuliJaga + noticeFee + warrantFee + other <= 0) {
    return res.status(400).json({ error: 'किमान एका रकमेत काहीतरी भरा' });
  }

  const [[property]] = await pool.query('SELECT id FROM property_master WHERE id = ?', [property_id]);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  // receipt_no हा त्याच receipt_type च्या मालिकेतला पुढचा क्रमांक -
  // छोट्या, एका-वेळी-एक-क्लर्क कार्यालयासाठी पुरेसे (जड locking नाही).
  const [[{ nextNo }]] = await pool.query(
    'SELECT COALESCE(MAX(receipt_no), 0) + 1 AS nextNo FROM tax_payments WHERE receipt_type = ?',
    [receipt_type]
  );

  const [result] = await pool.query(
    `INSERT INTO tax_payments
       (property_id, financial_year_id, payment_date, amount, receipt_type, receipt_no,
        khuli_jaga_amount, notice_fee_amount, warrant_fee_amount, other_amount, narration, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [property_id, financial_year_id, payment_date, amt, receipt_type, nextNo,
      khuliJaga, noticeFee, warrantFee, other, narration || null, req.user.id]
  );

  const alloc = await computeReceiptAllocation(property_id, financial_year_id, result.insertId, receipt_type);
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
