const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

// List all financial years
router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM financial_years ORDER BY year_label');
  res.json(rows);
});

// Add a new financial year (this is how the system grows year over year
// instead of requiring a schema change like the old wide anandoldnew table).
//
// By default this also carries forward the most recent prior year's
// property_tax_assessment rows into the new year (same property, same
// figures) so staff start from last year's numbers and only edit what
// changed (rate revisions, new area, etc.) instead of re-entering every
// one of ~1300 properties from scratch. Pass carry_forward: false to skip.
router.post('/', requirePermission('years', 'add'), async (req, res) => {
  const { year_label, start_date, end_date, is_active, carry_forward } = req.body || {};
  if (!year_label || !/^\d{4}-\d{4}$/.test(year_label)) {
    return res.status(400).json({ error: 'year_label is required in the form "YYYY-YYYY"' });
  }
  const shouldCarryForward = carry_forward !== false;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (is_active) {
      await conn.query('UPDATE financial_years SET is_active = 0');
    }
    const [result] = await conn.query(
      'INSERT INTO financial_years (year_label, start_date, end_date, is_active) VALUES (?, ?, ?, ?)',
      [year_label, start_date || null, end_date || null, is_active ? 1 : 0]
    );
    const newYearId = result.insertId;

    let carriedForwardFrom = null;
    let carriedForwardCount = 0;

    if (shouldCarryForward) {
      // "Previous year" = the most recent existing year that chronologically
      // precedes the one just added (string comparison sorts "YYYY-YYYY"
      // labels correctly), not necessarily the one right before it in id order.
      const [[prevYear]] = await conn.query(
        'SELECT id, year_label FROM financial_years WHERE year_label < ? ORDER BY year_label DESC LIMIT 1',
        [year_label]
      );
      if (prevYear) {
        const [copyResult] = await conn.query(
          `INSERT INTO property_tax_assessment
             (property_id, financial_year_id, new_length, new_width, area_sqft, area_sqm,
              jamin_rate_used, gasara_rate, bharank, bhandvalimula_rs, karacha_rate,
              gharpatti, divabatti, arogya, panipatti, total_tax, gov_status, narration)
           SELECT property_id, ?, new_length, new_width, area_sqft, area_sqm,
                  jamin_rate_used, gasara_rate, bharank, bhandvalimula_rs, karacha_rate,
                  gharpatti, divabatti, arogya, panipatti, total_tax, gov_status, narration
           FROM property_tax_assessment
           WHERE financial_year_id = ?`,
          [newYearId, prevYear.id]
        );
        carriedForwardFrom = prevYear.year_label;
        carriedForwardCount = copyResult.affectedRows;
      }
    }

    await conn.commit();

    const [[row]] = await pool.query('SELECT * FROM financial_years WHERE id = ?', [newYearId]);
    res.status(201).json({ ...row, carried_forward_from: carriedForwardFrom, carried_forward_count: carriedForwardCount });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This financial year already exists' });
    throw err;
  } finally {
    conn.release();
  }
});

router.patch('/:id/activate', requirePermission('years', 'add'), async (req, res) => {
  const { id } = req.params;
  await pool.query('UPDATE financial_years SET is_active = 0');
  const [result] = await pool.query('UPDATE financial_years SET is_active = 1 WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
