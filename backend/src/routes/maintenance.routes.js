// डेटाबेस बॅकअप/रि-स्टोअर - फक्त प्रशासकाला (admin), "इतर सुविधा" मेनूखाली.
// XAMPP सोबत आधीच असलेले mysqldump/mysql कमांड-लाईन वापरतो (start.bat
// प्रमाणेच स्थानिक MySQL); वेगळे npm पॅकेज लागत नाही. पासवर्ड कमांड-लाईन
// आर्ग्युमेंटमध्ये (process list मध्ये दिसू शकेल असे) न देता MYSQL_PWD
// environment variable मार्फत पाठवतो.
const express = require('express');
const { spawn } = require('child_process');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'gpweb';
const MYSQLDUMP_PATH = process.env.MYSQLDUMP_PATH || 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL_PATH = process.env.MYSQL_PATH || 'C:\\xampp\\mysql\\bin\\mysql.exe';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

router.get('/backup', requireAdmin, (req, res) => {
  const filename = `gpweb-backup-${timestamp()}.sql`;
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const dump = spawn(
    MYSQLDUMP_PATH,
    ['-h', DB_HOST, '-P', DB_PORT, '-u', DB_USER, '--routines', '--events', '--single-transaction', DB_NAME],
    { env: { ...process.env, MYSQL_PWD: DB_PASSWORD } }
  );

  let stderr = '';
  dump.stderr.on('data', (d) => { stderr += d.toString(); });
  dump.stdout.pipe(res);
  dump.on('error', (err) => {
    if (!res.headersSent) res.status(500).json({ error: `mysqldump चालवता आले नाही: ${err.message}` });
  });
  dump.on('close', (code) => {
    if (code !== 0) {
      console.error('mysqldump exited with code', code, stderr);
      if (!res.headersSent) res.status(500).json({ error: `बॅकअप अयशस्वी (कोड ${code}): ${stderr.slice(0, 2000)}` });
    }
  });
});

// रिस्टोअर फाईल कच्च्या (raw) मजकुरात (.sql) येते, JSON मध्ये नाही - म्हणून
// इथेच फक्त या राऊटपुरता express.text() (मोठ्या मर्यादेसह) वापरतो, बाकी
// राऊटवरील server.js च्या express.json() ला धक्का न लावता.
router.post('/restore', requireAdmin, express.text({ limit: '500mb', type: '*/*' }), (req, res) => {
  const sql = req.body;
  if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
    return res.status(400).json({ error: 'रिकामी किंवा अवैध .sql फाईल' });
  }

  const restore = spawn(
    MYSQL_PATH,
    ['-h', DB_HOST, '-P', DB_PORT, '-u', DB_USER, DB_NAME],
    { env: { ...process.env, MYSQL_PWD: DB_PASSWORD } }
  );

  let stderr = '';
  restore.stderr.on('data', (d) => { stderr += d.toString(); });
  restore.on('error', (err) => {
    if (!res.headersSent) res.status(500).json({ error: `mysql चालवता आले नाही: ${err.message}` });
  });
  restore.on('close', (code) => {
    if (res.headersSent) return;
    if (code === 0) res.json({ ok: true });
    else res.status(500).json({ error: `रि-स्टोअर अयशस्वी (कोड ${code}): ${stderr.slice(0, 2000)}` });
  });
  restore.stdin.write(sql);
  restore.stdin.end();
});

module.exports = router;
