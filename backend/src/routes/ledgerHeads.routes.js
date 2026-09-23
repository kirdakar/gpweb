// लेखाशीर्ष मास्टर - ग्रामपंचायत लेखा संहिता, २०११ नमुना १ चा स्थिर वृक्ष
// (एकदाच src/scripts/seedLedgerHeads.js ने भरलेला). इथून फक्त नाव-बदल
// करता येतो - संपूर्ण गट/झाड टाकणे-काढणे हे कायद्याने ठरलेले असल्याने
// वेगळ्या UI ने बांधकाम करण्याची गरज नाही (पहा schema.sql ची टिपणी).
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

// संपूर्ण सपाट यादी (parent_id सह) - मास्टर स्क्रीन झाडासारखी दाखवते,
// आणि दैनिक रोकड वही नोंदीचा शोधा-कंबो फक्त leaf (is_leaf=1) आयटम वापरतो.
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, code, group_type, parent_id, name, sort_order, is_leaf
     FROM ledger_heads ORDER BY group_type, sort_order`
  );
  res.json(rows);
});

router.patch('/:id', requirePermission('ledger_heads', 'edit'), async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'नाव आवश्यक आहे' });
  const [result] = await pool.query('UPDATE ledger_heads SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
