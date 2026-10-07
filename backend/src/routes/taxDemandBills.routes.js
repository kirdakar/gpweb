// कर मागणी बिल (नमुना ९क) चा कायमचा बिल नंबर (१ ते ९९९९९९) - प्रत्येक आर्थिक वर्षात प्रत्येक कोडला एकदाच,
// नंतर कधीही तोच. POST /assign: दिलेल्या कोडांपैकी ज्यांना नंबर नाही त्यांना (कोड वाढत्या क्रमाने) पुढचे
// नंबर देतो; आधीच असलेले बदलत नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const MAX_BILL_NO = 999999;

// body: { financialYearId, codes: [..], startAt? } -> { numbers: { "<code>": billNo }, assigned: <नवीन दिलेले संख्या> }
// startAt: त्या वर्षाचा पहिलाच नंबर देताना कोठून सुरू करायचे (डीफॉल्ट १); नंतर नेहमी (सध्याचा सर्वात मोठा + १).
router.post('/assign', requirePermission('reports_tax_demand_bill', 'view'), async (req, res) => {
  const yearId = Number(req.body?.financialYearId);
  if (!Number.isInteger(yearId) || yearId <= 0) return res.status(400).json({ error: 'financialYearId आवश्यक आहे' });
  const codes = [...new Set((req.body?.codes || []).map(Number).filter((c) => Number.isInteger(c) && c > 0))].sort((a, b) => a - b);
  let startAt = Number(req.body?.startAt);
  if (!Number.isInteger(startAt) || startAt < 1) startAt = 1;
  if (startAt > MAX_BILL_NO) return res.status(400).json({ error: `सुरुवातीचा नंबर १ ते ${MAX_BILL_NO} असावा` });
  if (codes.length === 0) return res.json({ numbers: {}, assigned: 0 });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // या वर्षाच्या नंबर मालिकेवर एका वेळी एकच जण नंबर देईल (दोन वापरकर्ते एकाच वेळी छापताना दुहेरी नंबर टळतात).
    await conn.query('SELECT id FROM financial_years WHERE id = ? FOR UPDATE', [yearId]);

    const [existing] = await conn.query(
      'SELECT property_code, bill_no FROM tax_demand_bills WHERE financial_year_id = ? AND property_code IN (?)', [yearId, codes]
    );
    const numbers = {};
    for (const r of existing) numbers[r.property_code] = r.bill_no;

    const missing = codes.filter((c) => numbers[c] === undefined);
    let assigned = 0;
    if (missing.length > 0) {
      const [[{ mx }]] = await conn.query('SELECT MAX(bill_no) AS mx FROM tax_demand_bills WHERE financial_year_id = ?', [yearId]);
      let next = mx == null ? startAt : mx + 1;
      if (next + missing.length - 1 > MAX_BILL_NO) {
        await conn.rollback();
        return res.status(400).json({ error: `बिल नंबर ${MAX_BILL_NO} पेक्षा जास्त होतील - सुरुवातीचा नंबर कमी करा किंवा कमी बिले निवडा` });
      }
      for (const c of missing) {
        await conn.query('INSERT INTO tax_demand_bills (financial_year_id, property_code, bill_no) VALUES (?, ?, ?)', [yearId, c, next]);
        numbers[c] = next;
        next += 1;
        assigned += 1;
      }
    }
    await conn.commit();
    res.json({ numbers, assigned });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
