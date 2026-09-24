// सार्वजनिक बांधकाम - नमुना २० (अंदाज), २०(क) (मोजमाप वही), २०(ख) (कामाचे देयक).
// एक साखळी, काहीही दोनदा टाईप करायचे नाही:
//   अंदाज ओळ (दर दरसूचीतून) -> मोजमाप (दर अंदाज ओळीवरून येतो, संख्या = नग x लांबी x रुंदी x खोली)
//   -> देयक (मोजमापाची एकूण रक्कम - आधीच्या देयकांची रक्कम) -> रोकड वहीत खर्च पोस्ट.
// संख्या/रक्कम साठवत नाही, नेहमी सर्व्हरवर मोजली जाते.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

const WORK_SELECT = `
  SELECT w.id, w.name, w.financial_year_id, w.ledger_head_id, w.sanction_order_no,
         DATE_FORMAT(w.sanction_date, '%Y-%m-%d') AS sanction_date, w.sanctioning_authority,
         w.contractor_id, w.status, w.remark,
         lh.code AS head_code, lh.name AS head_name, c.name AS contractor_name
  FROM works w
  JOIN ledger_heads lh ON lh.id = w.ledger_head_id
  LEFT JOIN contractors c ON c.id = w.contractor_id`;

function qtyOf(m) {
  return Math.round(Number(m.nos) * Number(m.length) * Number(m.breadth) * Number(m.depth) * 1000) / 1000;
}

// एका कामाचा सर्व तपशील + सर्व व्युत्पन्न रक्कमा.
async function loadWork(id) {
  const [[work]] = await pool.query(`${WORK_SELECT} WHERE w.id = ?`, [id]);
  if (!work) return null;
  const [items] = await pool.query('SELECT * FROM work_estimate_items WHERE work_id = ? ORDER BY id', [id]);
  const [meas] = await pool.query(
    `SELECT m.id, m.work_id, m.estimate_item_id, DATE_FORMAT(m.measured_on, '%Y-%m-%d') AS measured_on,
            m.location_note, m.nos, m.length, m.breadth, m.depth
     FROM work_measurements m WHERE m.work_id = ? ORDER BY m.measured_on, m.id`, [id]);
  const [bills] = await pool.query(
    `SELECT b.id, b.bill_no, DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS bill_date, b.contractor_id, c.name AS contractor_name,
            b.gross_to_date, b.previous_bills_total, b.deduction_amount, b.deduction_note, b.cash_book_entry_id
     FROM work_bills b LEFT JOIN contractors c ON c.id = b.contractor_id
     WHERE b.work_id = ? ORDER BY b.id`, [id]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const estimateItems = items.map((i) => ({ ...i, amount: round2(Number(i.quantity) * Number(i.rate)) }));
  const measurements = meas.map((m) => {
    const it = itemById.get(m.estimate_item_id);
    const quantity = qtyOf(m);
    const rate = it ? Number(it.rate) : 0;
    return { ...m, description: it?.description, unit: it?.unit, rate, quantity, amount: round2(quantity * rate) };
  });
  const bs = bills.map((b) => {
    const thisBill = round2(Number(b.gross_to_date) - Number(b.previous_bills_total));
    return { ...b, this_bill_amount: thisBill, net_payable: round2(thisBill - Number(b.deduction_amount)) };
  });
  const estimateTotal = round2(estimateItems.reduce((s, i) => s + i.amount, 0));
  const measuredTotal = round2(measurements.reduce((s, m) => s + m.amount, 0));
  const billedTotal = round2(bs.reduce((s, b) => s + b.this_bill_amount, 0));
  const [[muster]] = await pool.query(
    `SELECT COALESCE(SUM(mw.rate_per_day * (LENGTH(mw.attendance) - LENGTH(REPLACE(mw.attendance, 'P', ''))) - mw.fine), 0) AS wages
     FROM muster_rolls mr JOIN muster_workers mw ON mw.muster_roll_id = mr.id
     WHERE mr.work_id = ? AND mr.cash_book_entry_id IS NOT NULL`, [id]);
  return {
    ...work,
    estimate_items: estimateItems,
    measurements,
    bills: bs,
    summary: {
      estimate_total: estimateTotal,
      measured_total: measuredTotal,
      billed_total: billedTotal,
      unbilled_balance: round2(measuredTotal - billedTotal),
      muster_wages_posted: round2(Number(muster.wages)),
    },
  };
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  const where = financialYearId ? 'WHERE w.financial_year_id = ?' : '';
  const [rows] = await pool.query(`${WORK_SELECT} ${where} ORDER BY w.id DESC`, financialYearId ? [financialYearId] : []);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const w = await loadWork(req.params.id);
  if (!w) return res.status(404).json({ error: 'काम सापडले नाही' });
  res.json(w);
});

async function checkHead(ledgerHeadId) {
  const [[head]] = await pool.query('SELECT group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledgerHeadId]);
  if (!head) return 'लेखाशीर्ष सापडले नाही';
  if (!head.is_leaf) return 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते';
  if (head.group_type !== 'खर्च') return 'खर्च गटातील लेखाशीर्ष निवडा';
  return null;
}

router.post('/', requirePermission('works', 'add'), async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'कामाचे नाव आवश्यक आहे' });
  if (!b.financial_year_id || !b.ledger_head_id) return res.status(400).json({ error: 'वर्ष व लेखाशीर्ष आवश्यक आहेत' });
  const headErr = await checkHead(b.ledger_head_id);
  if (headErr) return res.status(400).json({ error: headErr });
  const [result] = await pool.query(
    `INSERT INTO works (name, financial_year_id, ledger_head_id, sanction_order_no, sanction_date, sanctioning_authority, contractor_id, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.name.trim(), b.financial_year_id, b.ledger_head_id, b.sanction_order_no || null, b.sanction_date || null,
      b.sanctioning_authority || null, b.contractor_id || null, b.remark || null]
  );
  res.status(201).json(await loadWork(result.insertId));
});

router.put('/:id', requirePermission('works', 'edit'), async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'कामाचे नाव आवश्यक आहे' });
  const [[cur]] = await pool.query('SELECT id, ledger_head_id FROM works WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'काम सापडले नाही' });
  const headId = b.ledger_head_id || cur.ledger_head_id;
  if (Number(headId) !== cur.ledger_head_id) {
    const headErr = await checkHead(headId);
    if (headErr) return res.status(400).json({ error: headErr });
  }
  await pool.query(
    `UPDATE works SET name = ?, ledger_head_id = ?, sanction_order_no = ?, sanction_date = ?, sanctioning_authority = ?,
       contractor_id = ?, status = ?, remark = ? WHERE id = ?`,
    [b.name.trim(), headId, b.sanction_order_no || null, b.sanction_date || null, b.sanctioning_authority || null,
      b.contractor_id || null, b.status === 'पूर्ण' ? 'पूर्ण' : 'चालू', b.remark || null, req.params.id]
  );
  res.json(await loadWork(req.params.id));
});

router.delete('/:id', requirePermission('works', 'delete'), async (req, res) => {
  const [[used]] = await pool.query(
    'SELECT (SELECT COUNT(*) FROM work_bills WHERE work_id = ?) + (SELECT COUNT(*) FROM muster_rolls WHERE work_id = ?) AS n', [req.params.id, req.params.id]);
  if (used.n > 0) return res.status(400).json({ error: 'या कामाची देयके/हजेरीपट नोंदलेले आहेत - मिटवता येणार नाही' });
  const [result] = await pool.query('DELETE FROM works WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

// ---- नमुना २० - अंदाज ओळी ----
router.post('/:id/estimate', requirePermission('works', 'edit'), async (req, res) => {
  const { rate_item_id, description, unit, quantity, rate } = req.body || {};
  let desc = description; let un = unit; let rt = rate;
  if (rate_item_id) {
    const [[ri]] = await pool.query('SELECT * FROM rate_schedule_items WHERE id = ?', [rate_item_id]);
    if (!ri) return res.status(404).json({ error: 'दरसूची ओळ सापडली नाही' });
    desc = desc || ri.description; un = un || ri.unit;
    if (rt === undefined || rt === '' || rt === null) rt = ri.rate;
  }
  if (!desc || !desc.trim() || !un || !un.trim()) return res.status(400).json({ error: 'तपशील व एकक आवश्यक आहेत' });
  if (!(Number(quantity) > 0)) return res.status(400).json({ error: 'परिमाण शून्यापेक्षा जास्त हवे' });
  if (!(Number(rt) >= 0)) return res.status(400).json({ error: 'दर योग्य नाही' });
  const [[w]] = await pool.query('SELECT id FROM works WHERE id = ?', [req.params.id]);
  if (!w) return res.status(404).json({ error: 'काम सापडले नाही' });
  await pool.query(
    'INSERT INTO work_estimate_items (work_id, rate_item_id, description, unit, quantity, rate) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.id, rate_item_id || null, desc.trim(), un.trim(), Number(quantity), Number(rt)]
  );
  res.status(201).json(await loadWork(req.params.id));
});

router.delete('/:id/estimate/:itemId', requirePermission('works', 'edit'), async (req, res) => {
  const [[m]] = await pool.query('SELECT COUNT(*) AS n FROM work_measurements WHERE estimate_item_id = ?', [req.params.itemId]);
  if (m.n > 0) return res.status(400).json({ error: 'या ओळीचे मोजमाप नोंदलेले आहे - मिटवता येणार नाही' });
  await pool.query('DELETE FROM work_estimate_items WHERE id = ? AND work_id = ?', [req.params.itemId, req.params.id]);
  res.json(await loadWork(req.params.id));
});

// ---- नमुना २०(क) - मोजमाप ----
router.post('/:id/measurements', requirePermission('works', 'edit'), async (req, res) => {
  const b = req.body || {};
  if (!b.estimate_item_id || !b.measured_on) return res.status(400).json({ error: 'अंदाज ओळ व दिनांक आवश्यक आहेत' });
  const [[item]] = await pool.query('SELECT id FROM work_estimate_items WHERE id = ? AND work_id = ?', [b.estimate_item_id, req.params.id]);
  if (!item) return res.status(404).json({ error: 'अंदाज ओळ या कामाची नाही' });
  const dim = (v) => (v === '' || v === undefined || v === null ? 1 : Number(v));
  const nos = dim(b.nos); const length = dim(b.length); const breadth = dim(b.breadth); const depth = dim(b.depth);
  if (![nos, length, breadth, depth].every((n) => Number.isFinite(n) && n > 0)) return res.status(400).json({ error: 'नग/लांबी/रुंदी/खोली शून्यापेक्षा जास्त हवी' });
  await pool.query(
    `INSERT INTO work_measurements (work_id, estimate_item_id, measured_on, location_note, nos, length, breadth, depth)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, b.estimate_item_id, b.measured_on, b.location_note || null, nos, length, breadth, depth]
  );
  res.status(201).json(await loadWork(req.params.id));
});

router.delete('/:id/measurements/:mid', requirePermission('works', 'edit'), async (req, res) => {
  const [[b]] = await pool.query('SELECT COUNT(*) AS n FROM work_bills WHERE work_id = ?', [req.params.id]);
  if (b.n > 0) return res.status(400).json({ error: 'देयक तयार झाल्यानंतर मोजमाप मिटवता येत नाही' });
  await pool.query('DELETE FROM work_measurements WHERE id = ? AND work_id = ?', [req.params.mid, req.params.id]);
  res.json(await loadWork(req.params.id));
});

// ---- नमुना २०(ख) - कामाचे देयक ----
router.post('/:id/bills', requirePermission('works', 'add'), async (req, res) => {
  const { bill_no, bill_date, contractor_id, deduction_amount, deduction_note } = req.body || {};
  if (!bill_date) return res.status(400).json({ error: 'देयक दिनांक आवश्यक आहे' });
  const w = await loadWork(req.params.id);
  if (!w) return res.status(404).json({ error: 'काम सापडले नाही' });

  const grossToDate = w.summary.measured_total;
  const previous = w.summary.billed_total;
  const thisBill = round2(grossToDate - previous);
  if (thisBill <= 0) return res.status(400).json({ error: 'नवीन मोजमाप नाही - आधीच्या देयकांपेक्षा जास्त रक्कम देता येत नाही' });
  const deduction = round2(Number(deduction_amount) || 0);
  if (deduction < 0 || deduction >= thisBill) return res.status(400).json({ error: 'कपात रक्कम योग्य नाही' });
  const net = round2(thisBill - deduction);
  const cId = contractor_id || w.contractor_id || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cash] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, reference_no, narration, created_by)
       VALUES (?, ?, ?, 'खर्च', 'मुख्य', ?, 'रोख', ?, ?, ?)`,
      [w.financial_year_id, bill_date, w.ledger_head_id, net, bill_no || null,
        `कामाचे देयक (नमुना २०ख) - ${w.name}`, req.user.id]
    );
    await conn.query(
      `INSERT INTO work_bills (work_id, bill_no, bill_date, contractor_id, gross_to_date, previous_bills_total, deduction_amount, deduction_note, cash_book_entry_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, bill_no || null, bill_date, cId, grossToDate, previous, deduction, deduction_note || null, cash.insertId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  res.status(201).json(await loadWork(req.params.id));
});

module.exports = router;
