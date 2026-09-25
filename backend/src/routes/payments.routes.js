const express = require('express');
const { postTaxPaymentToCashBook } = require('../utils/taxCashPosting');
const { ADJUSTMENT_KEYS, scaleYearRowsToNet } = require('../utils/taxAdjustments');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const {
  allocate, sumDue, round2, GROUP_ORDER_BY_TYPE, GHARPATTI_GROUP_ORDER, PANIPATTI_GROUP_ORDER,
  explodeDuesByPortion, collapseByComponent, getDetailedAllocationRows,
} = require('../utils/dueAllocation');
const {
  getDueBreakdownForProperty, getDueBreakdownForCode, getYearWiseDueRowsForCode, getTotalPaid, getTotalPaidForCode,
  getDueBreakdownBulk, getTotalPaidBulk, getCombinedAllocationForProperty,
} = require('../utils/dueBreakdown');

const router = express.Router();
router.use(requireAuth);

const RECEIPT_TYPES = ['gharpatti', 'panipatti'];
const PAYMENT_MODES = ['cash', 'cheque', 'upi'];
const DUE_COMPONENTS = [
  'previous_gharpatti', 'previous_divabatti', 'previous_arogya', 'previous_panipatti',
  'current_gharpatti', 'current_divabatti', 'current_arogya', 'current_panipatti',
];

function assertReceiptType(t) {
  if (!RECEIPT_TYPES.includes(t)) {
    const err = new Error("receiptType must be 'gharpatti' or 'panipatti'");
    err.status = 400;
    throw err;
  }
}

// एका कोडखालील सर्व मालमत्तांचे (portions) घटकनिहाय एकत्रित (बेरीज) आकडे -
// due-summary च्या "property" प्रदर्शनासाठी व receipt च्या "dues" साठी.
function aggregatePortions(portions) {
  const base = {
    property_code: portions[0]?.property_code ?? null,
    owner_name: portions[0]?.owner_name ?? null,
    malmata_no_list: [...new Set(portions.map((p) => p.malmata_no).filter(Boolean))].join(', '),
    portion_count: portions.length,
  };
  for (const key of [...DUE_COMPONENTS, ...ADJUSTMENT_KEYS]) {
    base[key] = round2(portions.reduce((s, p) => s + Number(p[key] || 0), 0));
  }
  base.discount_total = round2(portions.reduce((s, p) => s + Number(p.discount_total || 0), 0));
  base.penalty_total = round2(portions.reduce((s, p) => s + Number(p.penalty_total || 0), 0));
  return base;
}

// कोडखालील सर्व मालमत्तांची (portions) बाकी "एकत्रित" करून एकाच FIFO
// वाटपातून जाते - प्रत्येक घटकासाठी आधी सर्व मालमत्तांचे ते घटक (मालमत्ता
// क्रं. क्रमाने), मग पुढचा घटक (पहा dueAllocation.js explodeDuesByPortion).
// एकाच मालमत्तेचा कोड असेल तर हे जुन्या प्रति-मालमत्ता वागणुकीशी आपसूक जुळते.
// db: pool किंवा transaction connection (POST मध्ये insert+वाचन एकाच
// transaction मध्ये अणुरूप (atomic) ठेवण्यासाठी).
async function getCodeAllocationContext(db, propertyCode, yearId, receiptType) {
  const { year, portions } = await getDueBreakdownForCode(db, propertyCode, yearId);
  if (!year || portions.length === 0) return { year, portions: [] };
  const baseOrder = GROUP_ORDER_BY_TYPE[receiptType];
  const { dues, order } = explodeDuesByPortion(portions, baseOrder);
  return { year, portions, baseOrder, dues, order };
}

// कर जमा भरणे स्क्रीनसाठी: निवडलेल्या पावती-प्रकाराची (घरपट्टी किंवा
// पाणीपट्टी) देय रक्कम, त्याच प्रकारच्या (त्याच कोडखालील कोणत्याही
// मालमत्तेवरील) पावत्यांतून आजवर भरलेली एकूण रक्कम, आणि त्यानुसार वाटप.
//
// propertyId (यासह receiptType शिवाय) दिल्यास - उदा. नमुना ९ क (कर मागणी
// बिल, पावती नव्हे) - एका मालमत्तेचे घरपट्टी+पाणीपट्टी एकत्र combined वाटप
// जुन्याच 8-key आकारात (backward compatible) परत करतो.
router.get('/due-summary', async (req, res) => {
  const { propertyId, propertyCode, yearId, receiptType } = req.query;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });

  if (propertyCode) {
    if (!receiptType) return res.status(400).json({ error: 'receiptType is required with propertyCode' });
    assertReceiptType(receiptType);

    const { year, portions, baseOrder, dues, order } = await getCodeAllocationContext(pool, propertyCode, yearId, receiptType);
    if (!year) return res.status(404).json({ error: 'Financial year not found' });
    if (portions.length === 0) return res.status(404).json({ error: 'Property not found' });

    const totalPaid = await getTotalPaidForCode(pool, propertyCode, receiptType);
    const totalDue = sumDue(dues, order);
    const exploded = allocate(dues, totalPaid, order);
    const { paid, balance } = collapseByComponent(exploded, baseOrder);

    const [history] = await pool.query(
      `SELECT p.*, fy.year_label, pm.malmata_no FROM tax_payments p
       JOIN financial_years fy ON fy.id = p.financial_year_id
       JOIN property_master pm ON pm.id = p.property_id
       WHERE pm.property_code = ? AND p.receipt_type = ? ORDER BY p.payment_date, p.id`,
      [propertyCode, receiptType]
    );

    return res.json({
      property: aggregatePortions(portions),
      portions,
      year,
      receipt_type: receiptType,
      total_due: totalDue,
      total_paid: totalPaid,
      balance_due: Math.max(0, round2(totalDue - totalPaid)),
      unallocated_advance: exploded.unallocated,
      paid_by_component: paid,
      balance_by_component: balance,
      history,
    });
  }

  if (!propertyId) return res.status(400).json({ error: 'propertyId or propertyCode is required' });

  const { year, row } = await getDueBreakdownForProperty(pool, propertyId, yearId);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });
  if (!row) return res.status(404).json({ error: 'Property not found' });

  const { paid, balance, unallocated } = await getCombinedAllocationForProperty(pool, propertyId, yearId);
  const totalPaid = await getTotalPaid(pool, propertyId);
  const totalDue = sumDue(row);
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

// "मागील बाकी (देय)"/"चालू वर्ष (देय)"/"आजवर जमा (वसूल)" या due-summary
// मधील एकत्रित आकड्यांचा तपशील - वर्षवार, मालमत्ता क्रं.-वार, हेड-वार
// (पहा dueAllocation.js getDetailedAllocationRows). "जमा" रकमेचा वर्षनिहाय
// वाटा हा गृहीतकावर आधारित आहे - सर्वात जुने वर्ष आधी भरले जाते (त्याच
// FIFO क्रमाचा विस्तार), पण त्या गृहीतकाखालीही घटक/मालमत्तानिहाय बेरीज
// due-summary शी नेहमी तंतोतंत जुळते.
router.get('/due-detail', async (req, res) => {
  const { propertyCode, yearId, receiptType } = req.query;
  if (!propertyCode || !yearId) return res.status(400).json({ error: 'propertyCode and yearId are required' });
  assertReceiptType(receiptType);

  const { year, portions } = await getDueBreakdownForCode(pool, propertyCode, yearId);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });
  if (portions.length === 0) return res.status(404).json({ error: 'Property not found' });

  const { rows: rawYearRows } = await getYearWiseDueRowsForCode(pool, propertyCode, yearId);
  // सूट/दंड मुळे निव्वळ झालेल्या मागील बाकीशी वर्षवार ओळी जुळवतो
  const yearRows = scaleYearRowsToNet(rawYearRows, portions, year.year_label);
  const totalPaid = await getTotalPaidForCode(pool, propertyCode, receiptType);
  const baseOrder = GROUP_ORDER_BY_TYPE[receiptType];
  const detail = getDetailedAllocationRows(portions, yearRows, baseOrder, { id: Number(yearId), year_label: year.year_label }, totalPaid);

  res.json({ year, detail });
});

// कर मागणी बिल (नमुना ९ क) "सर्व बिले एकदम तयार करा" साठी - due-summary
// चीच गणना (allocate) प्रत्येक कोडसाठी एकाच वेळी, हजारो HTTP रिक्वेस्ट
// टाळण्यासाठी. फक्त थकबाकी/चालू देय असलेल्या मालमत्ता परत करतो. हे बिल
// (मागणी नोटीस, पावती नव्हे) घरपट्टी+पाणीपट्टी दोन्ही एकत्र दाखवते, त्यामुळे
// दोन्ही गटांचे स्वतंत्र वाटप एकत्र (combine) करून जुन्याच 8-key आकारात देतो.
//
// एका कोडखाली अनेक मालमत्ता (portions) असल्या तरी एकच बिल - मालमत्तावार
// स्वतंत्र बिले नकोत (मालमत्ता क्रमांक बिलावर यादी म्हणून दिसतात, पहा
// aggregatePortions) - कारण पावती नेहमी कोडमधल्या अँकर मालमत्तेवरच नोंदते,
// त्यामुळे प्रति-मालमत्ता वेगळे बिल दाखवणे दिशाभूल करणारे ठरते.
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

  const byCode = new Map();
  for (const r of rows) {
    const key = r.property_code ?? `__${r.property_id}`;
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(r);
  }

  const summaries = [];
  for (const portions of byCode.values()) {
    const totalPaidG = round2(portions.reduce((s, p) => s + (paidMapG[p.property_id] || 0), 0));
    const totalPaidP = round2(portions.reduce((s, p) => s + (paidMapP[p.property_id] || 0), 0));
    const gExploded = explodeDuesByPortion(portions, GHARPATTI_GROUP_ORDER);
    const pExploded = explodeDuesByPortion(portions, PANIPATTI_GROUP_ORDER);
    const gAlloc = allocate(gExploded.dues, totalPaidG, gExploded.order);
    const pAlloc = allocate(pExploded.dues, totalPaidP, pExploded.order);
    const { balance: gBalance } = collapseByComponent(gAlloc, GHARPATTI_GROUP_ORDER);
    const { balance: pBalance } = collapseByComponent(pAlloc, PANIPATTI_GROUP_ORDER);
    summaries.push({ property: aggregatePortions(portions), balance_by_component: { ...gBalance, ...pBalance } });
  }

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

// एका पावतीद्वारे नेमकी कोणती रक्कम (कोणत्या घटकात) वसूल झाली हे दाखवते -
// त्या कोडखालील सर्व मालमत्तांच्या (त्याच receipt_type च्या) cumulative
// रकमेत या पावतीचा नेमका वाटा कुठे पडतो (पहा getCodeAllocationContext).
async function computeReceiptAllocation(db, propertyCode, yearId, paymentId, receiptType) {
  const { portions, baseOrder, dues, order } = await getCodeAllocationContext(db, propertyCode, yearId, receiptType);
  if (portions.length === 0) return null;

  const [payments] = await db.query(
    `SELECT p.id, p.amount FROM tax_payments p
     JOIN property_master pm ON pm.id = p.property_id
     WHERE pm.property_code = ? AND p.receipt_type = ? ORDER BY p.payment_date, p.id`,
    [propertyCode, receiptType]
  );

  let cumulativeBefore = 0;
  let thisAmount = 0;
  for (const p of payments) {
    if (p.id === Number(paymentId)) { thisAmount = Number(p.amount); break; }
    cumulativeBefore += Number(p.amount);
  }

  const before = allocate(dues, cumulativeBefore, order);
  const after = allocate(dues, cumulativeBefore + thisAmount, order);
  const coveredExploded = {};
  for (const key of Object.keys(after.paid)) coveredExploded[key] = round2(after.paid[key] - before.paid[key]);

  const { paid: coveredByThisReceipt } = collapseByComponent({ paid: coveredExploded }, baseOrder);
  const { balance: balanceAfter } = collapseByComponent(after, baseOrder);

  return { dues: aggregatePortions(portions), coveredByThisReceipt, balanceAfter, amount: thisAmount };
}

router.get('/:id/receipt', async (req, res) => {
  const [[payment]] = await pool.query(
    `SELECT p.*, fy.year_label, pm.property_code FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     JOIN property_master pm ON pm.id = p.property_id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const alloc = await computeReceiptAllocation(pool, payment.property_code, payment.financial_year_id, payment.id, payment.receipt_type);
  res.json({ payment, ...alloc });
});

router.post('/', requirePermission('payments', 'add'), async (req, res) => {
  const {
    property_code, financial_year_id, payment_date, amount, narration, receipt_type,
    khuli_jaga_amount, notice_fee_amount, warrant_fee_amount, other_amount,
    payment_mode, bank_name, cheque_no,
  } = req.body || {};
  if (!property_code || !financial_year_id || !payment_date || !receipt_type) {
    return res.status(400).json({ error: 'property_code, financial_year_id, payment_date and receipt_type are required' });
  }
  assertReceiptType(receipt_type);
  const mode = PAYMENT_MODES.includes(payment_mode) ? payment_mode : 'cash';

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

  const { year, portions, order, dues } = await getCodeAllocationContext(pool, property_code, financial_year_id, receipt_type);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });
  if (portions.length === 0) return res.status(404).json({ error: 'या कोडची मिळकत सापडली नाही' });
  // पहिली मालमत्ता (मालमत्ता क्रं. क्रमाने) - पावती नोंदवण्यासाठी anchor म्हणून
  // वापरतो; due/वाटप मात्र नेहमी संपूर्ण कोडवरूनच काढले जाते (वर).
  const anchorPropertyId = portions[0].property_id;

  // कराची जमा रक्कम (amt) या कोडच्या सर्व मालमत्तांच्या एकत्रित येणे
  // बाकीपेक्षा जास्त भरता येऊ नये - खुली जागा/नोटीस/वारंट/इतर या रकमांना
  // बाकीच नसल्याने ही मर्यादा फक्त amt ला लागू.
  const alreadyPaid = await getTotalPaidForCode(pool, property_code, receipt_type);
  const balanceDue = round2(sumDue(dues, order) - alreadyPaid);
  if (amt > Math.max(0, balanceDue) + 0.004) {
    return res.status(400).json({ error: `कराची जमा रक्कम येणे बाकी (₹${Math.max(0, balanceDue).toFixed(2)}) पेक्षा जास्त भरता येणार नाही` });
  }

  // INSERT + नंतरची वाचन/गणना (computeReceiptAllocation) एकाच transaction
  // मध्ये - मध्येच काही चूक झाली (उदा. गणनेत bug) तर पावती अर्धवट/चुकीच्या
  // अवस्थेत साठून राहू नये (डबल-पावतीचा धोका टाळण्यासाठी - आधी हीच चूक
  // झाली होती, insert यशस्वी होऊनही रिस्पॉन्स error आला होता).
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // receipt_no हा त्याच receipt_type च्या मालिकेतला पुढचा क्रमांक (संपूर्ण
    // ग्रामपंचायतभर एकच मालिका) - छोट्या, एका-वेळी-एक-क्लर्क कार्यालयासाठी
    // पुरेसे (जड locking नाही).
    const [[{ nextNo }]] = await conn.query(
      'SELECT COALESCE(MAX(receipt_no), 0) + 1 AS nextNo FROM tax_payments WHERE receipt_type = ?',
      [receipt_type]
    );

    const [result] = await conn.query(
      `INSERT INTO tax_payments
         (property_id, financial_year_id, payment_date, amount, receipt_type, receipt_no,
          khuli_jaga_amount, notice_fee_amount, warrant_fee_amount, other_amount,
          payment_mode, bank_name, cheque_no, narration, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [anchorPropertyId, financial_year_id, payment_date, amt, receipt_type, nextNo,
        khuliJaga, noticeFee, warrantFee, other,
        mode, mode === 'cheque' ? (bank_name || null) : null, mode === 'cheque' ? (cheque_no || null) : null,
        narration || null, req.user.id]
    );

    const alloc = await computeReceiptAllocation(conn, property_code, financial_year_id, result.insertId, receipt_type);
    // रोकड वही (नमुना ५) मध्ये त्याच transaction मध्ये जमा नोंद - वेगळी नोंद करावी लागत नाही
    await postTaxPaymentToCashBook(conn, {
      id: result.insertId, financial_year_id, property_code, receipt_type, receipt_no: nextNo,
      payment_date, payment_mode: mode, amount: amt,
      khuli_jaga_amount: khuliJaga, notice_fee_amount: noticeFee, warrant_fee_amount: warrantFee, other_amount: other,
    }, alloc && alloc.coveredByThisReceipt, req.user.id);
    const [[payment]] = await conn.query(
      `SELECT p.*, fy.year_label FROM tax_payments p
       JOIN financial_years fy ON fy.id = p.financial_year_id
       WHERE p.id = ?`,
      [result.insertId]
    );

    await conn.commit();
    res.status(201).json({ payment, ...alloc });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

router.delete('/:id', requirePermission('payments', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM tax_payments WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.computeReceiptAllocation = computeReceiptAllocation; // backfill स्क्रिप्टसाठी
module.exports = router;
