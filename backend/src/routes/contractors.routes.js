// कंत्राटदार मास्टर - सार्वजनिक बांधकाम (नमुना २०ख) साठी.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const where = req.query.activeOnly === '1' ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM contractors ${where} ORDER BY is_active DESC, name`);
  res.json(rows);
});

router.post('/', requirePermission('contractors', 'add'), async (req, res) => {
  const { name, address, phone } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'नाव आवश्यक आहे' });
  const [result] = await pool.query('INSERT INTO contractors (name, address, phone) VALUES (?, ?, ?)', [name.trim(), address || null, phone || null]);
  const [[row]] = await pool.query('SELECT * FROM contractors WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.put('/:id', requirePermission('contractors', 'edit'), async (req, res) => {
  const { name, address, phone, is_active } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'नाव आवश्यक आहे' });
  const [result] = await pool.query(
    'UPDATE contractors SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?',
    [name.trim(), address || null, phone || null, is_active === false ? 0 : 1, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  const [[row]] = await pool.query('SELECT * FROM contractors WHERE id = ?', [req.params.id]);
  res.json(row);
});

router.delete('/:id', requirePermission('contractors', 'delete'), async (req, res) => {
  const [[used]] = await pool.query('SELECT (SELECT COUNT(*) FROM works WHERE contractor_id = ?) + (SELECT COUNT(*) FROM work_bills WHERE contractor_id = ?) AS n', [req.params.id, req.params.id]);
  if (used.n > 0) return res.status(400).json({ error: 'हा कंत्राटदार कामांमध्ये वापरलेला आहे - मिटवण्याऐवजी निष्क्रिय करा' });
  const [result] = await pool.query('DELETE FROM contractors WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
