// दरसूची (Schedule of Rates) मास्टर - कामाच्या अंदाजपत्रकातील (नमुना २०) ओळींचे दर येथून येतात.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const where = req.query.activeOnly === '1' ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM rate_schedule_items ${where} ORDER BY is_active DESC, description`);
  res.json(rows);
});

function validate(b) {
  if (!b.description || !b.description.trim()) return 'तपशील आवश्यक आहे';
  if (!b.unit || !b.unit.trim()) return 'एकक आवश्यक आहे';
  if (!(Number(b.rate) >= 0)) return 'दर योग्य नाही';
  return null;
}

router.post('/', requirePermission('rate_schedule', 'add'), async (req, res) => {
  const err = validate(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const { description, unit, rate } = req.body;
  const [result] = await pool.query('INSERT INTO rate_schedule_items (description, unit, rate) VALUES (?, ?, ?)', [description.trim(), unit.trim(), Number(rate)]);
  const [[row]] = await pool.query('SELECT * FROM rate_schedule_items WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.put('/:id', requirePermission('rate_schedule', 'edit'), async (req, res) => {
  const err = validate(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const { description, unit, rate, is_active } = req.body;
  const [result] = await pool.query(
    'UPDATE rate_schedule_items SET description = ?, unit = ?, rate = ?, is_active = ? WHERE id = ?',
    [description.trim(), unit.trim(), Number(rate), is_active === false ? 0 : 1, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  const [[row]] = await pool.query('SELECT * FROM rate_schedule_items WHERE id = ?', [req.params.id]);
  res.json(row);
});

// अंदाजपत्रकातील ओळींमध्ये दर कॉपी होतो (rate_item_id फक्त संदर्भ), त्यामुळे मिटवल्याने जुने अंदाज बदलत नाहीत.
router.delete('/:id', requirePermission('rate_schedule', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM rate_schedule_items WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
