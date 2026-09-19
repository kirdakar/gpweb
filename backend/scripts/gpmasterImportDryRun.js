require('dotenv').config();
const pool = require('../src/config/db');
const gpmaster = require('../backups/gpmaster_export.json');

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

(async () => {
  let matchedOne = 0;
  let matchedMany = 0;
  let matchedZero = 0;
  const manyExamples = [];
  const zeroExamples = [];

  for (const g of gpmaster) {
    const srno = g.SRNO;
    const malmataNo = clean(g.MALMATA_NO);
    const [rows] = await pool.query(
      'SELECT id, property_code, owner_name FROM property_master WHERE srno = ? AND TRIM(malmata_no) = ?',
      [srno, malmataNo]
    );
    if (rows.length === 1) matchedOne++;
    else if (rows.length > 1) {
      matchedMany++;
      if (manyExamples.length < 5) manyExamples.push({ srno, malmataNo, count: rows.length });
    } else {
      matchedZero++;
      if (zeroExamples.length < 10) zeroExamples.push({ srno, malmataNo, code: g.code, owner: g.OWNER_NAME });
    }
  }

  console.log('GPMASTER rows:', gpmaster.length);
  console.log('matched exactly 1 property_master row:', matchedOne);
  console.log('matched multiple (ambiguous):', matchedMany);
  console.log('matched zero (would be inserted as new):', matchedZero);
  console.log('ambiguous examples:', JSON.stringify(manyExamples, null, 2));
  console.log('zero-match examples:', JSON.stringify(zeroExamples, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
