// नमुना १६ (जंगम), २२ (स्थावर), २३ (रस्ते), २४ (जमिनी) - चारही मालमत्ता
// नोंदवह्या एकाच टेबलमध्ये (category नुसार वेगळ्या). स्थावर/रस्ते/जमीन
// यांच्या बेरजा नमुना ४ च्या A6/A7/A8 ओळींना पुरवतात (assetsLiabilities.routes.js).
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const CATEGORIES = ['जंगम', 'स्थावर', 'रस्ते', 'जमीन'];

router.get('/', async (req, res) => {
  const { category } = req.query;
  const where = [];
  const params = [];
  if (category) {
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'अवैध category' });
    where.push('category = ?');
    params.push(category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM fixed_assets ${whereSql} ORDER BY category, acquired_date, id`,
    params
  );
  res.json(rows);
});

router.get('/totals', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT category, COALESCE(SUM(cost_amount), 0) AS total FROM fixed_assets GROUP BY category`
  );
  const totals = {};
  for (const c of CATEGORIES) totals[c] = 0;
  for (const r of rows) totals[r.category] = Number(r.total);
  res.json(totals);
});

router.post('/', requirePermission('fixed_assets', 'add'), async (req, res) => {
  const {
    category, description, acquired_date, acquired_mode, quantity_or_measure,
    cost_amount, disposal_date, disposal_details, remark,
    disposal_quantity, disposal_authority, recovered_amount, recovered_deposit_date,
  } = req.body || {};
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'अवैध category' });
  if (!description || !description.trim()) return res.status(400).json({ error: 'वस्तूचे/मालमत्तेचे वर्णन आवश्यक आहे' });

  const [result] = await pool.query(
    `INSERT INTO fixed_assets
       (category, description, acquired_date, acquired_mode, quantity_or_measure, cost_amount, disposal_date, disposal_details, remark,
        disposal_quantity, disposal_authority, recovered_amount, recovered_deposit_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category, description.trim(), acquired_date || null, acquired_mode || null, quantity_or_measure || null,
      Number(cost_amount) || 0, disposal_date || null, disposal_details || null, remark || null,
      disposal_quantity || null, disposal_authority || null,
      recovered_amount === '' || recovered_amount == null ? null : Number(recovered_amount) || 0, recovered_deposit_date || null]
  );
  const [[row]] = await pool.query('SELECT * FROM fixed_assets WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.put('/:id', requirePermission('fixed_assets', 'edit'), async (req, res) => {
  const {
    description, acquired_date, acquired_mode, quantity_or_measure,
    cost_amount, disposal_date, disposal_details, remark,
    disposal_quantity, disposal_authority, recovered_amount, recovered_deposit_date,
  } = req.body || {};
  if (!description || !description.trim()) return res.status(400).json({ error: 'वस्तूचे/मालमत्तेचे वर्णन आवश्यक आहे' });

  // नमुना १६ चे अतिरिक्त रकाने फक्त पाठवले असतील तरच बदलतो - नमुना २२/२३/२४ चा फॉर्म ते पाठवत नाही, त्याने ते पुसू नयेत.
  const extraSets = [];
  const extraParams = [];
  if (disposal_quantity !== undefined) { extraSets.push('disposal_quantity = ?'); extraParams.push(disposal_quantity || null); }
  if (disposal_authority !== undefined) { extraSets.push('disposal_authority = ?'); extraParams.push(disposal_authority || null); }
  if (recovered_amount !== undefined) { extraSets.push('recovered_amount = ?'); extraParams.push(recovered_amount === '' || recovered_amount == null ? null : Number(recovered_amount) || 0); }
  if (recovered_deposit_date !== undefined) { extraSets.push('recovered_deposit_date = ?'); extraParams.push(recovered_deposit_date || null); }

  const [result] = await pool.query(
    `UPDATE fixed_assets SET description = ?, acquired_date = ?, acquired_mode = ?, quantity_or_measure = ?,
       cost_amount = ?, disposal_date = ?, disposal_details = ?, remark = ?${extraSets.map((x) => `, ${x}`).join('')} WHERE id = ?`,
    [description.trim(), acquired_date || null, acquired_mode || null, quantity_or_measure || null,
      Number(cost_amount) || 0, disposal_date || null, disposal_details || null, remark || null, ...extraParams, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  const [[row]] = await pool.query('SELECT * FROM fixed_assets WHERE id = ?', [req.params.id]);
  res.json(row);
});

router.delete('/:id', requirePermission('fixed_assets', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM fixed_assets WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
