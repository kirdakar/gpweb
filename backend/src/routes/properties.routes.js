const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { withOwnerNameFallback } = require('../utils/ownerName');

const router = express.Router();
router.use(requireAuth);

// GET /api/properties?search=&page=&pageSize=&yearId=
// When yearId is given, each property row includes that year's assessment
// totals (LEFT JOIN so properties with no assessment yet still show up).
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  // Capped well above this GP's total property count so report pages can
  // still request "all properties" in one call (e.g. for a search combo)
  // without needing a separate unpaginated endpoint.
  const pageSize = Math.min(5000, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;
  const search = (req.query.search || '').trim();
  const yearId = req.query.yearId ? parseInt(req.query.yearId, 10) : null;

  const where = [];
  const params = [];
  if (search) {
    where.push('(pm.owner_name LIKE ? OR pm.malmata_no LIKE ? OR pm.property_code = ? OR pm.srno = ?)');
    const like = `%${search}%`;
    const asNum = Number.isFinite(Number(search)) ? Number(search) : -1;
    params.push(like, like, asNum, asNum);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM property_master pm ${whereSql}`, params);

  const selectAssessment = yearId
    ? `, a.id AS assessment_id, a.gharpatti, a.divabatti, a.arogya, a.panipatti, a.total_tax`
    : '';
  const joinAssessment = yearId
    ? `LEFT JOIN property_tax_assessment a ON a.property_id = pm.id AND a.financial_year_id = ?`
    : '';
  const joinParams = yearId ? [yearId] : [];

  const [rows] = await pool.query(
    `SELECT pm.*, pt.par_name AS construction_type_name ${selectAssessment}
     FROM property_master pm
     LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     ${joinAssessment}
     ${whereSql}
     ORDER BY pm.property_code, pm.malmata_no
     LIMIT ? OFFSET ?`,
    [...joinParams, ...params, pageSize, offset]
  );

  res.json({ data: withOwnerNameFallback(rows), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

router.get('/:id', async (req, res) => {
  const [[property]] = await pool.query(
    `SELECT pm.*, pt.par_name AS construction_type_name
     FROM property_master pm
     LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     WHERE pm.id = ?`,
    [req.params.id]
  );
  if (!property) return res.status(404).json({ error: 'Not found' });

  const [assessments] = await pool.query(
    `SELECT a.*, fy.year_label
     FROM property_tax_assessment a
     JOIN financial_years fy ON fy.id = a.financial_year_id
     WHERE a.property_id = ?
     ORDER BY fy.year_label`,
    [req.params.id]
  );

  res.json({ ...property, assessments });
});

async function assertCodeAvailable(propertyCode, excludeId) {
  if (!propertyCode) return;
  const params = [propertyCode];
  let sql = 'SELECT id FROM property_master WHERE property_code = ?';
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
  const [rows] = await pool.query(sql, params);
  if (rows.length > 0) {
    const err = new Error(`Property code ${propertyCode} is already used by another property`);
    err.status = 409;
    throw err;
  }
}

router.post('/', requirePermission('properties', 'add'), async (req, res) => {
  const b = req.body || {};
  if (!b.owner_name) return res.status(400).json({ error: 'owner_name is required' });

  try {
    // Uniqueness of property_code is enforced going forward for new records
    // (see schema.sql note on why legacy duplicates weren't collapsed).
    await assertCodeAvailable(b.property_code || null, null);

    const [result] = await pool.query(
      `INSERT INTO property_master
         (property_code, srno, malmata_no, particulars, construction_type, owner_name, bhogvatdar, milkat_year, is_government, narration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.property_code || null, b.srno || null, b.malmata_no || null, b.particulars || null,
        b.construction_type || null, b.owner_name, b.bhogvatdar || null, b.milkat_year || null,
        b.is_government ? 1 : 0, b.narration || null,
      ]
    );
    const [[row]] = await pool.query('SELECT * FROM property_master WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.put('/:id', requirePermission('properties', 'edit'), async (req, res) => {
  const b = req.body || {};
  try {
    await assertCodeAvailable(b.property_code || null, req.params.id);

    const [result] = await pool.query(
      `UPDATE property_master SET
         property_code=?, srno=?, malmata_no=?, particulars=?, construction_type=?,
         owner_name=?, bhogvatdar=?, milkat_year=?, is_government=?, narration=?
       WHERE id=?`,
      [
        b.property_code || null, b.srno || null, b.malmata_no || null, b.particulars || null,
        b.construction_type || null, b.owner_name, b.bhogvatdar || null, b.milkat_year || null,
        b.is_government ? 1 : 0, b.narration || null, req.params.id,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    const [[row]] = await pool.query('SELECT * FROM property_master WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.delete('/:id', requirePermission('properties', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM property_master WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
