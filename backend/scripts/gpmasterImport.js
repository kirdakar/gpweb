// एकवेळचे (one-time) स्थलांतर: जुन्या Access प्रणालीतील gpmaster टेबल (आता
// D:\gpweb\backend\backups\gpmaster_export.json मध्ये एक्सपोर्ट केलेले) वापरून
// सध्याच्या property_master मधील रिकामे कोड/मालकाचे नाव भरतो - फक्त रिकाम्या
// फील्डसाठीच (आधीच भरलेला खरा डेटा कधीही बदलत नाही, "only if empty" पद्धत).
//
// जुळणी srno + मालमत्ता क्रं. (TRIM केलेले) यावर होते. एका जोडीसाठी gpmaster
// मध्ये अनेक ओळी सापडल्या तरी सर्व ओळींचा (code, owner_name) एकच जोडा असेल
// (उदा. एकाच मालमत्तेचे दोन उप-भाग/पोर्शन gpmaster मध्ये पुनरावृत्तीने आले
// असतील) तर ती जुळणी निर्विवाद मानतो; वेगवेगळे (code, owner) आढळल्यास ती
// नोंद अनिश्चित (unresolved) ठरवून बदलत नाही.
require('dotenv').config();
const pool = require('../src/config/db');
const gpmaster = require('../backups/gpmaster_export.json');

const DRY_RUN = process.argv.includes('--dry-run');

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

async function main() {
  // gpmaster: key -> list of candidate rows
  const byKey = new Map();
  for (const g of gpmaster) {
    const key = `${g.SRNO}|${clean(g.MALMATA_NO)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(g);
  }

  const [rows] = await pool.query(
    `SELECT id, srno, malmata_no, property_code, owner_name, bhogvatdar, construction_type, particulars, milkat_year
     FROM property_master
     WHERE property_code IS NULL OR property_code = '' OR owner_name IS NULL OR owner_name = ''`
  );

  let fixed = 0;
  let unresolvedNoMatch = 0;
  let unresolvedAmbiguous = 0;
  const fixLog = [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const r of rows) {
      const key = `${r.srno}|${clean(r.malmata_no)}`;
      const candidates = byKey.get(key) || [];
      if (candidates.length === 0) { unresolvedNoMatch++; continue; }

      const distinctPairs = new Map();
      for (const c of candidates) {
        const pairKey = `${c.code}|${clean(c.OWNER_NAME)}`;
        if (!distinctPairs.has(pairKey)) distinctPairs.set(pairKey, c);
      }
      if (distinctPairs.size > 1) { unresolvedAmbiguous++; continue; }

      const g = [...distinctPairs.values()][0];
      const updates = {};
      if (isBlank(r.property_code) && g.code != null) updates.property_code = g.code;
      if (isBlank(r.owner_name) && clean(g.OWNER_NAME)) updates.owner_name = clean(g.OWNER_NAME);
      if (isBlank(r.bhogvatdar) && clean(g.BHOGVATDAR)) updates.bhogvatdar = clean(g.BHOGVATDAR);
      if (isBlank(r.construction_type) && g.T != null) updates.construction_type = g.T;
      if (isBlank(r.particulars) && clean(g.PARTICULARS)) updates.particulars = clean(g.PARTICULARS);
      if (isBlank(r.milkat_year) && clean(g.MILKAT_YEAR)) updates.milkat_year = clean(g.MILKAT_YEAR);

      if (Object.keys(updates).length === 0) continue; // matched but nothing new to fill

      fixed++;
      fixLog.push({ id: r.id, srno: r.srno, malmata_no: r.malmata_no, updates });

      if (!DRY_RUN) {
        const setSql = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
        const params = [...Object.values(updates), r.id];
        await conn.query(`UPDATE property_master SET ${setSql} WHERE id = ?`, params);
      }
    }

    if (DRY_RUN) await conn.rollback();
    else await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}rows examined (blank code or owner): ${rows.length}`);
  console.log('fixed (filled from gpmaster):', fixed);
  console.log('unresolved - no gpmaster match:', unresolvedNoMatch);
  console.log('unresolved - ambiguous gpmaster candidates:', unresolvedAmbiguous);
  console.log('fix log (first 20):', JSON.stringify(fixLog.slice(0, 20), null, 2));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
