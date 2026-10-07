// QR कोड मास्टर - घरपट्टी (gharpatti) व पाणीपट्टी (panipatti) भरण्याचे QR चित्र टेबलमध्ये (LONGBLOB) साठवतो.
// चित्र कर मागणी बिल (नमुना ९क) वर छापण्यासाठी वाचता येते (फक्त लॉगिन आवश्यक), बदलण्यासाठी
// 'payment_qr' स्क्रीनचा edit अधिकार लागतो. अपलोड base64 data-URL म्हणून JSON मध्ये येतो (वेगळ्या
// multipart लायब्ररीची गरज नाही) - server.js मध्ये या मार्गासाठी मोठी JSON मर्यादा लावली आहे.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); // इथे /api no-store मिडलवेअरच्या आधी नोंदवलेले आहे
router.use(requireAuth);

const TYPES = ['gharpatti', 'panipatti'];
const MIME_OK = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

function checkType(req, res, next) {
  if (!TYPES.includes(req.params.type)) return res.status(400).json({ error: "प्रकार 'gharpatti' किंवा 'panipatti' असावा" });
  next();
}

// दोन्ही प्रकारांची माहिती (चित्राशिवाय) - चित्र नोंदवले आहे का, शीर्षक/UPI मजकूर.
router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT qr_type, mime_type, file_name, caption, updated_at FROM payment_qr');
  res.json(rows);
});

router.get('/:type/image', checkType, async (req, res) => {
  const [[row]] = await pool.query('SELECT image, mime_type FROM payment_qr WHERE qr_type = ?', [req.params.type]);
  if (!row) return res.status(404).json({ error: 'QR चित्र नोंदवलेले नाही' });
  res.set('Content-Type', row.mime_type);
  res.send(row.image);
});

// body: { image?: "data:image/png;base64,...", file_name?, caption? } - image न दिल्यास फक्त शीर्षक बदलते
// (चित्र आधीच नोंदवलेले असणे आवश्यक).
router.put('/:type', requirePermission('payment_qr', 'edit'), checkType, async (req, res) => {
  const { image, file_name: fileName, caption } = req.body || {};
  const cap = String(caption ?? '').trim().slice(0, 200) || null;

  if (!image) {
    const [r] = await pool.query('UPDATE payment_qr SET caption = ?, updated_by = ? WHERE qr_type = ?', [cap, req.user.id, req.params.type]);
    if (r.affectedRows === 0) return res.status(400).json({ error: 'आधी QR चित्र निवडून जतन करा' });
    return res.json({ ok: true });
  }

  const m = String(image).match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!m || !MIME_OK.includes(m[1])) return res.status(400).json({ error: 'फक्त PNG, JPG किंवा WEBP चित्र चालेल' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0 || buf.length > MAX_BYTES) return res.status(400).json({ error: 'चित्र 2 MB पेक्षा लहान असावे' });

  await pool.query(
    `INSERT INTO payment_qr (qr_type, image, mime_type, file_name, caption, updated_by) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE image = VALUES(image), mime_type = VALUES(mime_type), file_name = VALUES(file_name),
                             caption = VALUES(caption), updated_by = VALUES(updated_by)`,
    [req.params.type, buf, m[1], String(fileName ?? '').slice(0, 200) || null, cap, req.user.id]
  );
  res.json({ ok: true });
});

router.delete('/:type', requirePermission('payment_qr', 'edit'), checkType, async (req, res) => {
  await pool.query('DELETE FROM payment_qr WHERE qr_type = ?', [req.params.type]);
  res.json({ ok: true });
});

module.exports = router;
