// नमुना २६-ख - मासिक शिल्लक विवरण. प्रारंभिक/अखेरची शिल्लक रोकड वहीवरून
// (नमुना ५, register='मुख्य', त्या आर्थिक वर्षातील एकूण जमा - एकूण खर्च) काढली
// जाते, साठवली जात नाही; फक्त ती शिल्लक कोठे ठेवली आहे (हातात/बँक/पोस्ट/
// अल्पबचत/मुदत ठेव) हाताने भरली जाते, आणि त्यांची बेरीज रोकड वहीच्या शिल्लकेशी
// जुळते का (difference) ते दाखवले जाते - कागदी नमुन्यातील "प्रमाणित करण्यात
// येते की शिल्लक रोकड वहीएवढी आहे" या ओळीचे तपासणी रूप.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

const FIELDS = ['in_hand', 'in_bank', 'in_post', 'savings_certificates', 'fixed_deposits'];

// "2025-2026" -> एप्रिल 2025 ते मार्च 2026 या १२ महिन्यांची यादी.
function monthsOfYearLabel(label) {
  const start = Number(String(label).slice(0, 4));
  const out = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1;
    out.push({ year: m >= 4 ? start : start + 1, month: m });
  }
  return out;
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  if (!financialYearId) return res.status(400).json({ error: 'financialYearId is required' });
  const [[fy]] = await pool.query('SELECT id, year_label FROM financial_years WHERE id = ?', [financialYearId]);
  if (!fy) return res.status(404).json({ error: 'आर्थिक वर्ष सापडले नाही' });

  const [netRows] = await pool.query(
    `SELECT YEAR(entry_date) AS y, MONTH(entry_date) AS m,
            SUM(CASE WHEN entry_type = 'जमा' THEN amount ELSE -amount END) AS net
     FROM cash_book_entries WHERE financial_year_id = ? AND register = 'मुख्य' GROUP BY y, m`,
    [financialYearId]
  );
  const netByKey = new Map(netRows.map((r) => [`${r.y}-${r.m}`, Number(r.net)]));
  const [saved] = await pool.query('SELECT * FROM monthly_balance_statements WHERE financial_year_id = ?', [financialYearId]);
  const savedByKey = new Map(saved.map((s) => [`${s.year}-${s.month}`, s]));

  let running = 0;
  const result = monthsOfYearLabel(fy.year_label).map(({ year, month }) => {
    const key = `${year}-${month}`;
    const opening = running;
    running += netByKey.get(key) || 0;
    const s = savedByKey.get(key) || {};
    const row = { year, month, opening: round2(opening), closing: round2(running), remark: s.remark || '' };
    let componentsTotal = 0;
    for (const f of FIELDS) { row[f] = Number(s[f] || 0); componentsTotal += row[f]; }
    row.components_total = round2(componentsTotal);
    row.difference = round2(componentsTotal - running);
    row.entered = Boolean(s.id);
    return row;
  });
  res.json(result);
});

router.put('/', requirePermission('balance_statements', 'edit'), async (req, res) => {
  const { financial_year_id, entries } = req.body || {};
  if (!financial_year_id || !Array.isArray(entries)) return res.status(400).json({ error: 'financial_year_id व entries आवश्यक आहेत' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      const vals = FIELDS.map((f) => Number(e[f]) || 0);
      await conn.query(
        `INSERT INTO monthly_balance_statements (financial_year_id, year, month, ${FIELDS.join(', ')}, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ${FIELDS.map((f) => `${f} = VALUES(${f})`).join(', ')}, remark = VALUES(remark)`,
        [financial_year_id, Number(e.year), Number(e.month), ...vals, e.remark || null]
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
