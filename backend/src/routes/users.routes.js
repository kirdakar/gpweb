const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');
const { SCREENS } = require('../config/screens');

const router = express.Router();
router.use(requireAuth);

const VALID_KEYS = new Set(SCREENS.flatMap((s) => s.actions.map((a) => `${s.code}:${a}`)));

// स्क्रीन/अधिकार मॅट्रिक्स कोणत्या actions दाखवायच्या हे ठरवण्यासाठी frontend
// हीच यादी वापरतो - डुप्लिकेट कॉपी टाळण्यासाठी बॅकएंडवरूनच आणतो.
router.get('/screens', requireAdmin, (req, res) => res.json(SCREENS));

// लॉगिन झालेल्या वापरकर्त्याचे स्वतःचे अधिकार - मेनू आयटम/बटणे दाखवायची की
// लपवायची हे frontend यावरून ठरवतो. requireAdmin नाही - कोणताही लॉगिन-केलेला
// वापरकर्ता स्वतःचे अधिकार बघू शकतो.
router.get('/me/permissions', async (req, res) => {
  if (req.user.role === 'admin') {
    const all = {};
    for (const key of VALID_KEYS) all[key] = true;
    return res.json(all);
  }
  const [rows] = await pool.query(
    'SELECT screen_code, action_code, allowed FROM user_permissions WHERE user_id = ?',
    [req.user.id]
  );
  const map = {};
  for (const r of rows) map[`${r.screen_code}:${r.action_code}`] = !!r.allowed;
  res.json(map);
});

router.get('/', requireAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT id, username, full_name, role, created_at FROM users ORDER BY username');
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { username, password, full_name, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username आणि password आवश्यक आहेत' });
  if (password.length < 6) return res.status(400).json({ error: 'Password किमान 6 अक्षरी असावा' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, full_name || null, role === 'admin' ? 'admin' : 'user']
    );
    const [[row]] = await pool.query(
      'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?', [result.insertId]
    );
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'हे username आधीच वापरात आहे' });
    throw err;
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { full_name, role } = req.body || {};
  const [result] = await pool.query(
    'UPDATE users SET full_name = ?, role = ? WHERE id = ?',
    [full_name || null, role === 'admin' ? 'admin' : 'user', req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'वापरकर्ता सापडला नाही' });
  const [[row]] = await pool.query('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?', [req.params.id]);
  res.json(row);
});

router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password किमान 6 अक्षरी असावा' });
  const hash = await bcrypt.hash(newPassword, 10);
  const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'वापरकर्ता सापडला नाही' });
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'स्वतःचे खाते स्वतः मिटवता येणार नाही' });
  }
  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'वापरकर्ता सापडला नाही' });
  res.json({ ok: true });
});

// एका (इतर) वापरकर्त्याचे सर्व स्क्रीन/action अधिकार - न नोंदवलेली जोडी false गृहीत धरते.
router.get('/:id/permissions', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT screen_code, action_code, allowed FROM user_permissions WHERE user_id = ?',
    [req.params.id]
  );
  const map = {};
  for (const r of rows) map[`${r.screen_code}:${r.action_code}`] = !!r.allowed;
  res.json(map);
});

// संपूर्ण मॅट्रिक्स एकाच वेळी जतन करतो - body: { "properties:view": true, "properties:add": false, ... }
// (जुनी सर्व नोंद आधी मिटवून नव्याने टाकतो, त्यामुळे न पाठवलेली key आपसूक false होते).
router.put('/:id/permissions', requireAdmin, async (req, res) => {
  const perms = req.body || {};
  const entries = Object.entries(perms).filter(([key, allowed]) => allowed && VALID_KEYS.has(key));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [req.params.id]);
    if (entries.length) {
      const values = entries.map(([key]) => {
        const [screen_code, action_code] = key.split(':');
        return [req.params.id, screen_code, action_code, 1];
      });
      await conn.query('INSERT INTO user_permissions (user_id, screen_code, action_code, allowed) VALUES ?', [values]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
