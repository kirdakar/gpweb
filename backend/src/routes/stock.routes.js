// नमुना १५ - उपभोग्य वस्तू साठा लेखा नोंदवही. वस्तू मास्टर (/items) आणि प्रत्येक
// वस्तूच्या हालचाली (/movements). प्रारंभिक शिल्लक/एकूण/शिल्लक चालू बेरजेवरून
// मोजली जाते (साठवत नाही).
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const r3 = (n) => Math.round(n * 1000) / 1000;

// ---- वस्तू मास्टर ----
router.get('/items', async (req, res) => {
  const where = req.query.activeOnly === '1' ? 'WHERE is_active = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM stock_items ${where} ORDER BY is_active DESC, name`);
  res.json(rows);
});

router.post('/items', requirePermission('stock_items', 'add'), async (req, res) => {
  const { name, unit } = req.body || {};
  if (!name || !name.trim() || !unit || !unit.trim()) return res.status(400).json({ error: 'नाव व एकक आवश्यक आहेत' });
  const [r] = await pool.query('INSERT INTO stock_items (name, unit) VALUES (?, ?)', [name.trim(), unit.trim()]);
  const [[row]] = await pool.query('SELECT * FROM stock_items WHERE id = ?', [r.insertId]);
  res.status(201).json(row);
});

router.put('/items/:id', requirePermission('stock_items', 'edit'), async (req, res) => {
  const { name, unit, is_active } = req.body || {};
  if (!name || !name.trim() || !unit || !unit.trim()) return res.status(400).json({ error: 'नाव व एकक आवश्यक आहेत' });
  const [r] = await pool.query('UPDATE stock_items SET name = ?, unit = ?, is_active = ? WHERE id = ?', [name.trim(), unit.trim(), is_active === false ? 0 : 1, req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  const [[row]] = await pool.query('SELECT * FROM stock_items WHERE id = ?', [req.params.id]);
  res.json(row);
});

router.delete('/items/:id', requirePermission('stock_items', 'delete'), async (req, res) => {
  const [[u]] = await pool.query('SELECT COUNT(*) AS n FROM stock_movements WHERE item_id = ?', [req.params.id]);
  if (u.n > 0) return res.status(400).json({ error: 'या वस्तूच्या नोंदी आहेत - मिटवण्याऐवजी निष्क्रिय करा' });
  await pool.query('DELETE FROM stock_items WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ---- हालचाली ----
async function movementsFor(itemId) {
  const [rows] = await pool.query(
    `SELECT id, item_id, DATE_FORMAT(move_date, '%Y-%m-%d') AS move_date, kind, quantity, purpose_to, officer_name, receiver_name, remark
     FROM stock_movements WHERE item_id = ? ORDER BY move_date, id`, [itemId]);
  let bal = 0;
  return rows.map((m) => {
    const q = Number(m.quantity);
    const opening = bal;
    const received = m.kind === 'दिले' ? 0 : q;
    const issued = m.kind === 'दिले' ? q : 0;
    bal = r3(bal + received - issued);
    return { ...m, opening_before: opening, received, total_available: r3(opening + received), issued, balance_after: bal };
  });
}

router.get('/movements', async (req, res) => {
  const { itemId } = req.query;
  if (!itemId) return res.status(400).json({ error: 'वस्तू निवडा' });
  const rows = await movementsFor(itemId);
  res.json({ movements: rows, balance: rows.length ? rows[rows.length - 1].balance_after : 0 });
});

router.post('/movements', requirePermission('stock_register', 'add'), async (req, res) => {
  const { item_id, move_date, kind, quantity, purpose_to, officer_name, receiver_name, remark } = req.body || {};
  if (!item_id || !move_date) return res.status(400).json({ error: 'वस्तू व दिनांक आवश्यक आहेत' });
  if (!['प्रारंभिक', 'मिळाले', 'दिले'].includes(kind)) return res.status(400).json({ error: 'प्रकार योग्य नाही' });
  const q = Number(quantity);
  if (!(q > 0)) return res.status(400).json({ error: 'संख्या शून्यापेक्षा जास्त हवी' });
  const rows = await movementsFor(item_id);
  const bal = rows.length ? rows[rows.length - 1].balance_after : 0;
  if (kind === 'प्रारंभिक' && rows.length > 0) return res.status(400).json({ error: 'प्रारंभिक शिल्लक फक्त पहिली नोंद म्हणून देता येते' });
  if (kind === 'दिले' && q > bal) return res.status(400).json({ error: `दिलेली संख्या शिल्लकेपेक्षा (${bal}) जास्त आहे` });
  await pool.query(
    `INSERT INTO stock_movements (item_id, move_date, kind, quantity, purpose_to, officer_name, receiver_name, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [item_id, move_date, kind, q, purpose_to || null, officer_name || null, receiver_name || null, remark || null]
  );
  res.status(201).json({ ok: true });
});

// शेवटची नोंदच मिटवता येते (पुढील शिल्लक बिघडू नये म्हणून).
router.delete('/movements/:id', requirePermission('stock_register', 'delete'), async (req, res) => {
  const [[m]] = await pool.query('SELECT item_id FROM stock_movements WHERE id = ?', [req.params.id]);
  if (!m) return res.status(404).json({ error: 'सापडले नाही' });
  const [[last]] = await pool.query('SELECT id FROM stock_movements WHERE item_id = ? ORDER BY move_date DESC, id DESC LIMIT 1', [m.item_id]);
  if (String(last.id) !== String(req.params.id)) return res.status(400).json({ error: 'फक्त शेवटची नोंद मिटवता येते' });
  await pool.query('DELETE FROM stock_movements WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
