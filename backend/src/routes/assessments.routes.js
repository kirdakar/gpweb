const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { calculateAssessment } = require('../utils/taxCalc');

const router = express.Router();
router.use(requireAuth);

// Live calculation preview (no save) - mirrors Form3.vb's CalculateValues.
router.post('/calc', (req, res) => {
  res.json(calculateAssessment(req.body || {}));
});

router.get('/', async (req, res) => {
  const { propertyId, yearId } = req.query;
  const where = [];
  const params = [];
  if (propertyId) { where.push('a.property_id = ?'); params.push(propertyId); }
  if (yearId) { where.push('a.financial_year_id = ?'); params.push(yearId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT a.*, fy.year_label, pm.owner_name, pm.malmata_no, pm.srno, pm.property_code
     FROM property_tax_assessment a
     JOIN financial_years fy ON fy.id = a.financial_year_id
     JOIN property_master pm ON pm.id = a.property_id
     ${whereSql}
     ORDER BY a.id DESC`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT a.*, fy.year_label FROM property_tax_assessment a
     JOIN financial_years fy ON fy.id = a.financial_year_id
     WHERE a.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requirePermission('properties', 'add'), async (req, res) => {
  const b = req.body || {};
  if (!b.property_id || !b.financial_year_id) {
    return res.status(400).json({ error: 'property_id and financial_year_id are required' });
  }
  const calc = calculateAssessment(b);

  try {
    const [result] = await pool.query(
      `INSERT INTO property_tax_assessment
         (property_id, financial_year_id, new_length, new_width, area_sqft, area_sqm,
          jamin_rate_used, gasara_rate, bharank, bhandvalimula_rs, karacha_rate,
          gharpatti, divabatti, arogya, panipatti, total_tax, gov_status, narration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.property_id, b.financial_year_id, calc.new_length, calc.new_width, calc.area_sqft, calc.area_sqm,
        calc.jamin_rate_used, calc.gasara_rate, calc.bharank, calc.bhandvalimula_rs, calc.karacha_rate,
        calc.gharpatti, calc.divabatti, calc.arogya, calc.panipatti, calc.total_tax,
        b.gov_status || 0, b.narration || null,
      ]
    );
    const [[row]] = await pool.query('SELECT * FROM property_tax_assessment WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An assessment for this property and year already exists. Use update instead.' });
    }
    throw err;
  }
});

router.put('/:id', requirePermission('properties', 'edit'), async (req, res) => {
  const b = req.body || {};
  const calc = calculateAssessment(b);

  const [result] = await pool.query(
    `UPDATE property_tax_assessment SET
       new_length=?, new_width=?, area_sqft=?, area_sqm=?, jamin_rate_used=?, gasara_rate=?, bharank=?,
       bhandvalimula_rs=?, karacha_rate=?, gharpatti=?, divabatti=?, arogya=?, panipatti=?, total_tax=?,
       gov_status=?, narration=?
     WHERE id=?`,
    [
      calc.new_length, calc.new_width, calc.area_sqft, calc.area_sqm, calc.jamin_rate_used, calc.gasara_rate, calc.bharank,
      calc.bhandvalimula_rs, calc.karacha_rate, calc.gharpatti, calc.divabatti, calc.arogya, calc.panipatti, calc.total_tax,
      b.gov_status || 0, b.narration || null, req.params.id,
    ]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  const [[row]] = await pool.query('SELECT * FROM property_tax_assessment WHERE id = ?', [req.params.id]);
  res.json(row);
});

router.delete('/:id', requirePermission('properties', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM property_tax_assessment WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
