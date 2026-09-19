const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

// यादी - शोध (कोड किंवा नाव) सह. एकूण संख्या (900+) 2000 च्या आतच राहील असे
// गृहीत धरून कॅप केलेली यादी परत करतो - नवीन मिळकत नोंद स्क्रीनवरील combo
// संपूर्ण यादी एकदाच आणून क्लायंटवरच शोधतो (इतर combo screens प्रमाणेच).
router.get('/', async (req, res) => {
  const search = (req.query.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    const asNum = Number.isFinite(Number(search)) ? Number(search) : -1;
    const [rows] = await pool.query(
      'SELECT * FROM gpmaster WHERE owner_name LIKE ? OR code = ? ORDER BY code LIMIT 2000',
      [like, asNum]
    );
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM gpmaster ORDER BY code LIMIT 2000');
  res.json(rows);
});

// पुढचा उपलब्ध कोड सुचवण्यासाठी - GPMASTER स्क्रीनवर नवीन कोड जोडताना
// (auto-increment सुविधा). '/:code' आधी असणे आवश्यक आहे, नाहीतर तो राऊट
// "next-code" हाच एक कोड समजून घेईल.
router.get('/next-code', async (req, res) => {
  const [[row]] = await pool.query('SELECT COALESCE(MAX(code), 0) + 1 AS next_code FROM gpmaster');
  res.json({ next_code: row.next_code });
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
