// नमुना १३ - कर्मचारी सूची व वेतनश्रेणी नोंदवही. स्थिर रोस्टर मास्टर
// (कोणते पद, कोण नियुक्त, कोणती वेतनश्रेणी) - नमुना २१ (मासिक वेतन देयक)
// याच यादीतील कर्मचाऱ्यांसाठी दर महिना भरले जाते.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const EMPLOYMENT_TYPES = ['पूर्णकालिक', 'अंशकालिक'];

router.get('/', async (req, res) => {
  const { activeOnly } = req.query;
  const where = activeOnly === '1' ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM staff_master ${where} ORDER BY is_active DESC, post_name`);
  res.json(rows);
});

router.post('/', requirePermission('staff_master', 'add'), async (req, res) => {
  const {
    post_name, post_count, sanction_order_no, sanction_date, employment_type,
    pay_scale, employee_name, appointment_date, remark,
  } = req.body || {};
  if (!post_name || !post_name.trim()) return res.status(400).json({ error: 'पदनाम आवश्यक आहे' });
  const empType = EMPLOYMENT_TYPES.includes(employment_type) ? employment_type : 'पूर्णकालिक';

  const [result] = await pool.query(
    `INSERT INTO staff_master
       (post_name, post_count, sanction_order_no, sanction_date, employment_type, pay_scale, employee_name, appointment_date, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [post_name.trim(), Number(post_count) || 1, sanction_order_no || null, sanction_date || null, empType,
      pay_scale || null, employee_name || null, appointment_date || null, remark || null]
  );
  const [[row]] = await pool.query('SELECT * FROM staff_master WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.put('/:id', requirePermission('staff_master', 'edit'), async (req, res) => {
  const {
    post_name, post_count, sanction_order_no, sanction_date, employment_type,
    pay_scale, employee_name, appointment_date, is_active, remark,
  } = req.body || {};
  if (!post_name || !post_name.trim()) return res.status(400).json({ error: 'पदनाम आवश्यक आहे' });
  const empType = EMPLOYMENT_TYPES.includes(employment_type) ? employment_type : 'पूर्णकालिक';

  const [result] = await pool.query(
    `UPDATE staff_master SET post_name = ?, post_count = ?, sanction_order_no = ?, sanction_date = ?,
       employment_type = ?, pay_scale = ?, employee_name = ?, appointment_date = ?, is_active = ?, remark = ?
     WHERE id = ?`,
    [post_name.trim(), Number(post_count) || 1, sanction_order_no || null, sanction_date || null, empType,
      pay_scale || null, employee_name || null, appointment_date || null, is_active === false ? 0 : 1, remark || null,
      req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  const [[row]] = await pool.query('SELECT * FROM staff_master WHERE id = ?', [req.params.id]);
  res.json(row);
});

router.delete('/:id', requirePermission('staff_master', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM staff_master WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
