const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM particular_master ORDER BY par_code');
  res.json(rows);
});

router.get('/:parCode', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM particular_master WHERE par_code = ?', [req.params.parCode]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.post('/', requirePermission('particulars', 'add'), async (req, res) => {
  const { par_code, par_name, gharpatti_rate, jamin_rate, divabatti_rate, arogya_rate, panipatti_rate } = req.body || {};
  if (!par_code || !par_name) return res.status(400).json({ error: 'par_code and par_name are required' });
  try {
    await pool.query(
      `INSERT INTO particular_master (par_code, par_name, gharpatti_rate, jamin_rate, divabatti_rate, arogya_rate, panipatti_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [par_code, par_name, gharpatti_rate || 0, jamin_rate || 0, divabatti_rate || 0, arogya_rate || 0, panipatti_rate || 0]
    );
    const [[row]] = await pool.query('SELECT * FROM particular_master WHERE par_code = ?', [par_code]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'par_code already exists' });
    throw err;
  }
});

router.put('/:parCode', requirePermission('particulars', 'edit'), async (req, res) => {
  const { par_name, gharpatti_rate, jamin_rate, divabatti_rate, arogya_rate, panipatti_rate } = req.body || {};
  const [result] = await pool.query(
    `UPDATE particular_master SET par_name=?, gharpatti_rate=?, jamin_rate=?, divabatti_rate=?, arogya_rate=?, panipatti_rate=?
     WHERE par_code=?`,
    [par_name, gharpatti_rate || 0, jamin_rate || 0, divabatti_rate || 0, arogya_rate || 0, panipatti_rate || 0, req.params.parCode]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  const [[row]] = await pool.query('SELECT * FROM particular_master WHERE par_code = ?', [req.params.parCode]);
  res.json(row);
});

router.delete('/:parCode', requirePermission('particulars', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM particular_master WHERE par_code = ?', [req.params.parCode]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
