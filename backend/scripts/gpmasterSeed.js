// gpmaster (मिळकतदार मास्टर) टेबल आधीच एक्सपोर्ट केलेल्या जुन्या GPMASTER
// डेटावरून (backups/gpmaster_export.json) भरतो - कोड -> मालकाचे नांव अशी
// यादी. एकाच कोडला gpmaster मध्ये अनेक ओळी (उप-भाग) असू शकतात, पण नांव तेच
// असते; त्यामुळे प्रत्येक कोडसाठी पहिले सापडलेले नांव घेतो.
require('dotenv').config();
const pool = require('../src/config/db');
const gpmaster = require('../backups/gpmaster_export.json');

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function main() {
  const byCode = new Map();
  for (const g of gpmaster) {
    if (g.code == null) continue;
    const owner = clean(g.OWNER_NAME);
    if (!owner) continue;
    if (!byCode.has(g.code)) byCode.set(g.code, owner);
  }

  console.log('distinct codes to seed:', byCode.size);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [code, owner_name] of byCode) {
      await conn.query(
        'INSERT INTO gpmaster (code, owner_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE owner_name = owner_name',
        [code, owner_name]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [[{ c }]] = await pool.query('SELECT COUNT(*) c FROM gpmaster');
  console.log('gpmaster rows now:', c);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
