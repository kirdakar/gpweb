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
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

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
  // नमुना २२ (स्थावर): प्रत्येक मालमत्तेवरील दुरुस्ती/फेरफार खर्चाच्या नोंदी (तारखा 'YYYY-MM-DD' मजकूर - dateStrings)
  const [exp] = await pool.query(
    `SELECT id, asset_id, expense_date, current_repairs, special_repairs, original_construction, work_nature,
            current_nature, special_nature, original_nature
     FROM fixed_asset_expenses ORDER BY expense_date, id`
  );
  const byAsset = new Map();
  for (const e of exp) {
    if (!byAsset.has(e.asset_id)) byAsset.set(e.asset_id, []);
    byAsset.get(e.asset_id).push(e);
  }
  res.json(rows.map((r) => ({ ...r, expenses: byAsset.get(r.id) || [] })));
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
    survey_no, purpose, asset_class, from_place, to_place, length_km, width_km, road_type,
  } = req.body || {};
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'अवैध category' });
  if (!description || !description.trim()) return res.status(400).json({ error: 'वस्तूचे/मालमत्तेचे वर्णन आवश्यक आहे' });

  const [result] = await pool.query(
    `INSERT INTO fixed_assets
       (category, description, acquired_date, acquired_mode, quantity_or_measure, cost_amount, disposal_date, disposal_details, remark,
        disposal_quantity, disposal_authority, recovered_amount, recovered_deposit_date, survey_no, purpose, asset_class,
        from_place, to_place, length_km, width_km, road_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category, description.trim(), acquired_date || null, acquired_mode || null, quantity_or_measure || null,
      Number(cost_amount) || 0, disposal_date || null, disposal_details || null, remark || null,
      disposal_quantity || null, disposal_authority || null,
      recovered_amount === '' || recovered_amount == null ? null : Number(recovered_amount) || 0, recovered_deposit_date || null,
      survey_no || null, purpose || null, [1, 2, 3, 4].includes(Number(asset_class)) ? Number(asset_class) : null,
      from_place || null, to_place || null, numOrNull(length_km), numOrNull(width_km), road_type || null]
  );
  const [[row]] = await pool.query('SELECT * FROM fixed_assets WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.put('/:id', requirePermission('fixed_assets', 'edit'), async (req, res) => {
  const {
    description, acquired_date, acquired_mode, quantity_or_measure,
    cost_amount, disposal_date, disposal_details, remark,
    disposal_quantity, disposal_authority, recovered_amount, recovered_deposit_date,
    survey_no, purpose, asset_class, from_place, to_place, length_km, width_km, road_type,
  } = req.body || {};
  if (!description || !description.trim()) return res.status(400).json({ error: 'वस्तूचे/मालमत्तेचे वर्णन आवश्यक आहे' });

  // नमुना १६ चे अतिरिक्त रकाने फक्त पाठवले असतील तरच बदलतो - नमुना २२/२३/२४ चा फॉर्म ते पाठवत नाही, त्याने ते पुसू नयेत.
  const extraSets = [];
  const extraParams = [];
  if (disposal_quantity !== undefined) { extraSets.push('disposal_quantity = ?'); extraParams.push(disposal_quantity || null); }
  if (disposal_authority !== undefined) { extraSets.push('disposal_authority = ?'); extraParams.push(disposal_authority || null); }
  if (recovered_amount !== undefined) { extraSets.push('recovered_amount = ?'); extraParams.push(recovered_amount === '' || recovered_amount == null ? null : Number(recovered_amount) || 0); }
  if (recovered_deposit_date !== undefined) { extraSets.push('recovered_deposit_date = ?'); extraParams.push(recovered_deposit_date || null); }
  if (survey_no !== undefined) { extraSets.push('survey_no = ?'); extraParams.push(survey_no || null); }
  if (purpose !== undefined) { extraSets.push('purpose = ?'); extraParams.push(purpose || null); }
  if (from_place !== undefined) { extraSets.push('from_place = ?'); extraParams.push(from_place || null); }
  if (to_place !== undefined) { extraSets.push('to_place = ?'); extraParams.push(to_place || null); }
  if (length_km !== undefined) { extraSets.push('length_km = ?'); extraParams.push(numOrNull(length_km)); }
  if (width_km !== undefined) { extraSets.push('width_km = ?'); extraParams.push(numOrNull(width_km)); }
  if (road_type !== undefined) { extraSets.push('road_type = ?'); extraParams.push(road_type || null); }
  if (asset_class !== undefined) { extraSets.push('asset_class = ?'); extraParams.push([1, 2, 3, 4].includes(Number(asset_class)) ? Number(asset_class) : null); }

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

// नमुना २२ रकाने (७)-(११): मालमत्तेवर वर्षभरात दुरुस्त्या/फेरफारासाठी केलेला खर्च - प्रत्येक खर्चाची स्वतंत्र नोंद.
router.post('/:id/expenses', requirePermission('fixed_assets', 'edit'), async (req, res) => {
  const b = req.body || {};
  const [[asset]] = await pool.query('SELECT id FROM fixed_assets WHERE id = ?', [req.params.id]);
  if (!asset) return res.status(404).json({ error: 'मालमत्ता सापडली नाही' });
  if (!b.expense_date) return res.status(400).json({ error: 'खर्चाची तारीख आवश्यक आहे' });
  const cur = Number(b.current_repairs) || 0;
  const spe = Number(b.special_repairs) || 0;
  const orig = Number(b.original_construction) || 0;
  if (cur < 0 || spe < 0 || orig < 0) return res.status(400).json({ error: 'रक्कम ऋण असू शकत नाही' });
  if (cur + spe + orig <= 0) return res.status(400).json({ error: 'किमान एक रक्कम भरा' });
  await pool.query(
    `INSERT INTO fixed_asset_expenses (asset_id, expense_date, current_repairs, special_repairs, original_construction, work_nature,
       current_nature, special_nature, original_nature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, b.expense_date, cur, spe, orig, b.work_nature || null,
      b.current_nature || null, b.special_nature || null, b.original_nature || null]
  );
  res.status(201).json({ ok: true });
});

router.delete('/expenses/:expenseId', requirePermission('fixed_assets', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM fixed_asset_expenses WHERE id = ?', [req.params.expenseId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
