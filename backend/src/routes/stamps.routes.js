// नमुना १४ - मुद्रांक हिशोब नोंदवही. मिळालेले/वापरलेले मुद्रांक नोंदतात; दैनिक
// शिल्लक चालू बेरजेवरून मोजली जाते (साठवत नाही). मुद्रांक खरेदी/विक्रीचा पैसा
// नेहमीप्रमाणे नमुना ५/७ मध्ये नोंदतो - येथे फक्त मुद्रांकांचा साठा.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

async function allWithBalance() {
  const [rows] = await pool.query(
    `SELECT id, financial_year_id, DATE_FORMAT(entry_date, '%Y-%m-%d') AS entry_date, kind, ref_no,
            DATE_FORMAT(ref_date, '%Y-%m-%d') AS ref_date, amount, remark
     FROM stamp_entries ORDER BY entry_date, id`);
  let bal = 0;
  return rows.map((r) => {
    bal = round2(bal + (r.kind === 'मिळाले' ? 1 : -1) * Number(r.amount));
    return { ...r, balance: bal };
  });
}

// सर्व नोंदी (चालू शिल्लकेसह) - वर्षानुसार गाळणी frontend करतो, कारण शिल्लक वर्षांमध्ये पुढे जाते.
router.get('/', async (req, res) => {
  const rows = await allWithBalance();
  const { financialYearId } = req.query;
  res.json(financialYearId ? rows.filter((r) => String(r.financial_year_id) === String(financialYearId)) : rows);
});

router.post('/', requirePermission('stamps', 'add'), async (req, res) => {
  const { financial_year_id, entry_date, kind, ref_no, ref_date, amount, remark } = req.body || {};
  if (!financial_year_id || !entry_date) return res.status(400).json({ error: 'वर्ष व दिनांक आवश्यक आहेत' });
  if (!['मिळाले', 'वापरले'].includes(kind)) return res.status(400).json({ error: 'प्रकार योग्य नाही' });
  const amt = round2(Number(amount));
  if (!(amt > 0)) return res.status(400).json({ error: 'किंमत शून्यापेक्षा जास्त हवी' });
  if (kind === 'वापरले') {
    const all = await allWithBalance();
    const bal = all.length ? all[all.length - 1].balance : 0;
    if (amt > bal) return res.status(400).json({ error: `वापरलेल्या मुद्रांकांची किंमत शिल्लकेपेक्षा (${bal.toFixed(2)}) जास्त आहे` });
  }
  await pool.query(
    'INSERT INTO stamp_entries (financial_year_id, entry_date, kind, ref_no, ref_date, amount, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [financial_year_id, entry_date, kind, ref_no || null, ref_date || null, amt, remark || null]
  );
  res.status(201).json({ ok: true });
});

// सर्वात शेवटची नोंदच मिटवता येते - मधली नोंद मिटवल्यास पुढील शिल्लक उणे होऊ शकते.
router.delete('/:id', requirePermission('stamps', 'delete'), async (req, res) => {
  const [[last]] = await pool.query('SELECT id FROM stamp_entries ORDER BY entry_date DESC, id DESC LIMIT 1');
  if (!last || String(last.id) !== String(req.params.id)) return res.status(400).json({ error: 'फक्त शेवटची नोंद मिटवता येते' });
  await pool.query('DELETE FROM stamp_entries WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
