const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

// यादी - शोध (कोड किंवा नाव) सह. मोठी यादी (900+) असू शकते म्हणून शोधाशिवाय
// कॅप केलेली (500) यादी परत करतो; स्क्रीनवरचा शोध सर्व्हरवरच होतो.
router.get('/', async (req, res) => {
  const search = (req.query.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    const asNum = Number.isFinite(Number(search)) ? Number(search) : -1;
    const [rows] = await pool.query(
      'SELECT * FROM gpmaster WHERE owner_name LIKE ? OR code = ? ORDER BY code LIMIT 500',
      [like, asNum]
    );
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM gpmaster ORDER BY code LIMIT 500');
  res.json(rows);
});

// एका कोडचे नांव थेट आणण्यासाठी - नवीन मिळकत नोंद भरताना कोड टाकल्यावर
// मालकाचे नांव आपोआप भरण्यासाठी वापरतो (पहा frontend PropertyDetail.jsx).
router.get('/:code', async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM gpmaster WHERE code = ?', [req.params.code]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requirePermission('gpmaster', 'add'), async (req, res) => {
  const { code, owner_name } = req.body || {};
  if (!code || !owner_name) return res.status(400).json({ error: 'code and owner_name are required' });
  try {
    await pool.query('INSERT INTO gpmaster (code, owner_name) VALUES (?, ?)', [code, owner_name]);
    const [[row]] = await pool.query('SELECT * FROM gpmaster WHERE code = ?', [code]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'हा कोड आधीच वापरात आहे' });
    throw err;
  }
});

router.put('/:code', requirePermission('gpmaster', 'edit'), async (req, res) => {
  const { owner_name } = req.body || {};
  if (!owner_name) return res.status(400).json({ error: 'owner_name is required' });
  const [result] = await pool.query('UPDATE gpmaster SET owner_name = ? WHERE code = ?', [owner_name, req.params.code]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  const [[row]] = await pool.query('SELECT * FROM gpmaster WHERE code = ?', [req.params.code]);
  res.json(row);
});

router.delete('/:code', requirePermission('gpmaster', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM gpmaster WHERE code = ?', [req.params.code]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
