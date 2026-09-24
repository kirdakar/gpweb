// नमुना १९ - कामावरील हजेरीपट (मजुरी हिशोबासह). हजेरी 'P'/'A' च्या 31 अक्षरी
// स्ट्रिंगमध्ये साठवतात; दिवस व मजुरी सर्व्हरवर मोजली जाते. "पोस्ट करा" केल्यावर
// एकूण मजुरी रोकड वहीत (नमुना ५) खर्च म्हणून एकदाच जाते.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

function normAttendance(s) {
  const a = String(s || '').toUpperCase().replace(/[^PA]/g, 'A');
  return a.padEnd(31, 'A').slice(0, 31);
}
function computeWorker(w) {
  const days = (String(w.attendance).match(/P/g) || []).length;
  const gross = round2(days * Number(w.rate_per_day));
  return { ...w, days, gross_wage: gross, net_wage: round2(gross - Number(w.fine || 0)) };
}

const ROLL_SELECT = `
  SELECT r.id, r.work_id, r.financial_year_id, r.year, r.month, r.title, r.ledger_head_id, r.cash_book_entry_id,
         w.name AS work_name, lh.code AS head_code, lh.name AS head_name
  FROM muster_rolls r
  LEFT JOIN works w ON w.id = r.work_id
  JOIN ledger_heads lh ON lh.id = r.ledger_head_id`;

async function loadRoll(id) {
  const [[roll]] = await pool.query(`${ROLL_SELECT} WHERE r.id = ?`, [id]);
  if (!roll) return null;
  const [ws] = await pool.query('SELECT * FROM muster_workers WHERE muster_roll_id = ? ORDER BY id', [id]);
  const workers = ws.map(computeWorker);
  return { ...roll, workers, total_wages: round2(workers.reduce((s, w) => s + w.net_wage, 0)) };
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  const [rows] = await pool.query(
    `${ROLL_SELECT} ${financialYearId ? 'WHERE r.financial_year_id = ?' : ''} ORDER BY r.year DESC, r.month DESC, r.id DESC`,
    financialYearId ? [financialYearId] : []
  );
  const out = [];
  for (const r of rows) {
    const [ws] = await pool.query('SELECT * FROM muster_workers WHERE muster_roll_id = ?', [r.id]);
    const workers = ws.map(computeWorker);
    out.push({ ...r, worker_count: workers.length, total_wages: round2(workers.reduce((s, w) => s + w.net_wage, 0)) });
  }
  res.json(out);
});

router.get('/:id', async (req, res) => {
  const r = await loadRoll(req.params.id);
  if (!r) return res.status(404).json({ error: 'हजेरीपट सापडला नाही' });
  res.json(r);
});

async function validateRoll(b) {
  if (!b.financial_year_id || !b.year || !b.month || !b.ledger_head_id) return 'वर्ष, महिना व लेखाशीर्ष आवश्यक आहेत';
  if (!(Number(b.month) >= 1 && Number(b.month) <= 12)) return 'महिना योग्य नाही';
  const [[head]] = await pool.query('SELECT group_type, is_leaf FROM ledger_heads WHERE id = ?', [b.ledger_head_id]);
  if (!head) return 'लेखाशीर्ष सापडले नाही';
  if (!head.is_leaf) return 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते';
  if (head.group_type !== 'खर्च') return 'खर्च गटातील लेखाशीर्ष निवडा';
  const workers = Array.isArray(b.workers) ? b.workers : [];
  if (workers.length === 0) return 'किमान एक मजूर आवश्यक आहे';
  for (const w of workers) {
    if (!w.name || !String(w.name).trim()) return 'प्रत्येक मजुराचे नाव आवश्यक आहे';
    if (!(Number(w.rate_per_day) >= 0)) return 'मजुरीचा दर योग्य नाही';
    if (!(Number(w.fine || 0) >= 0)) return 'दंड योग्य नाही';
  }
  return null;
}

async function insertWorkers(conn, rollId, workers) {
  for (const w of workers) {
    await conn.query(
      `INSERT INTO muster_workers (muster_roll_id, name, address, gender, post, rate_per_day, attendance, fine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rollId, String(w.name).trim(), w.address || null, w.gender || null, w.post || null,
        Number(w.rate_per_day) || 0, normAttendance(w.attendance), Number(w.fine) || 0]
    );
  }
}

router.post('/', requirePermission('muster_rolls', 'add'), async (req, res) => {
  const b = req.body || {};
  const err = await validateRoll(b);
  if (err) return res.status(400).json({ error: err });
  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO muster_rolls (work_id, financial_year_id, year, month, title, ledger_head_id) VALUES (?, ?, ?, ?, ?, ?)',
      [b.work_id || null, b.financial_year_id, b.year, b.month, b.title || null, b.ledger_head_id]
    );
    id = r.insertId;
    await insertWorkers(conn, id, b.workers);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.status(201).json(await loadRoll(id));
});

router.put('/:id', requirePermission('muster_rolls', 'edit'), async (req, res) => {
  const b = req.body || {};
  const [[cur]] = await pool.query('SELECT id, cash_book_entry_id FROM muster_rolls WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'हजेरीपट सापडला नाही' });
  if (cur.cash_book_entry_id) return res.status(400).json({ error: 'रोकड वहीत पोस्ट झालेला हजेरीपट बदलता येत नाही' });
  const err = await validateRoll(b);
  if (err) return res.status(400).json({ error: err });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE muster_rolls SET work_id = ?, year = ?, month = ?, title = ?, ledger_head_id = ? WHERE id = ?',
      [b.work_id || null, b.year, b.month, b.title || null, b.ledger_head_id, req.params.id]
    );
    await conn.query('DELETE FROM muster_workers WHERE muster_roll_id = ?', [req.params.id]);
    await insertWorkers(conn, req.params.id, b.workers);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json(await loadRoll(req.params.id));
});

router.post('/:id/post', requirePermission('muster_rolls', 'edit'), async (req, res) => {
  const roll = await loadRoll(req.params.id);
  if (!roll) return res.status(404).json({ error: 'हजेरीपट सापडला नाही' });
  if (roll.cash_book_entry_id) return res.status(400).json({ error: 'हा हजेरीपट आधीच रोकड वहीत नोंदवला आहे' });
  if (roll.total_wages <= 0) return res.status(400).json({ error: 'एकूण मजुरी शून्यापेक्षा जास्त हवी' });
  const entryDate = (req.body && req.body.entry_date) || new Date().toISOString().slice(0, 10);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cash] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'खर्च', 'मुख्य', ?, 'रोख', ?, ?)`,
      [roll.financial_year_id, entryDate, roll.ledger_head_id, roll.total_wages,
        `मजुरी - हजेरीपट (नमुना १९) ${roll.month}/${roll.year}${roll.work_name ? ' - ' + roll.work_name : ''}${roll.title ? ' - ' + roll.title : ''}`, req.user.id]
    );
    await conn.query('UPDATE muster_rolls SET cash_book_entry_id = ? WHERE id = ?', [cash.insertId, req.params.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json(await loadRoll(req.params.id));
});

router.delete('/:id', requirePermission('muster_rolls', 'delete'), async (req, res) => {
  const [[cur]] = await pool.query('SELECT cash_book_entry_id FROM muster_rolls WHERE id = ?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'सापडले नाही' });
  if (cur.cash_book_entry_id) return res.status(400).json({ error: 'रोकड वहीत पोस्ट झालेला हजेरीपट मिटवता येत नाही' });
  await pool.query('DELETE FROM muster_rolls WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
