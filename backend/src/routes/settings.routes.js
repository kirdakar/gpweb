const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [[row]] = await pool.query('SELECT gp_name, taluka, district FROM gp_settings WHERE id = 1');
  res.json(row || { gp_name: '', taluka: '', district: '' });
});

router.put('/', requirePermission('settings', 'edit'), async (req, res) => {
  const { gp_name, taluka, district } = req.body || {};
  await pool.query(
    'UPDATE gp_settings SET gp_name = ?, taluka = ?, district = ? WHERE id = 1',
    [gp_name || '', taluka || '', district || '']
  );
  const [[row]] = await pool.query('SELECT gp_name, taluka, district FROM gp_settings WHERE id = 1');
  res.json(row);
});

module.exports = router;
