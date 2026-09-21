// Computes घरपट्टी/दिवाबत्ती/आरोग्य/पाणीपट्टी dues split into "previous"
// (every year chronologically before the given one, combined) and
// "current" (the given year itself) - the same जुनी/नविन split used by the
// थकबाकी/येणे बाकी report. Shared so payment entry, receipts, and reports
// all compute it identically.
const { withOwnerNameFallback } = require('./ownerName');
const { allocate, GHARPATTI_GROUP_ORDER, PANIPATTI_GROUP_ORDER } = require('./dueAllocation');

// One property.
async function getDueBreakdownForProperty(pool, propertyId, yearId) {
  const [[year]] = await pool.query('SELECT * FROM financial_years WHERE id = ?', [yearId]);
  if (!year) return { year: null, row: null };

  const [[row]] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name,
            COALESCE(cur.gharpatti, 0) AS current_gharpatti,
            COALESCE(cur.divabatti, 0) AS current_divabatti,
            COALESCE(cur.arogya, 0) AS current_arogya,
            COALESCE(cur.panipatti, 0) AS current_panipatti,
            COALESCE(prev.p_gharpatti, 0) AS previous_gharpatti,
            COALESCE(prev.p_divabatti, 0) AS previous_divabatti,
            COALESCE(prev.p_arogya, 0) AS previous_arogya,
            COALESCE(prev.p_panipatti, 0) AS previous_panipatti
     FROM property_master pm
     LEFT JOIN property_tax_assessment cur
       ON cur.property_id = pm.id AND cur.financial_year_id = ?
     LEFT JOIN (
       SELECT a.property_id,
              SUM(a.gharpatti) AS p_gharpatti, SUM(a.divabatti) AS p_divabatti,
              SUM(a.arogya) AS p_arogya, SUM(a.panipatti) AS p_panipatti
       FROM property_tax_assessment a
       JOIN financial_years fy ON fy.id = a.financial_year_id
       WHERE fy.year_label < ?
       GROUP BY a.property_id
     ) prev ON prev.property_id = pm.id
     WHERE pm.id = ?`,
    [yearId, year.year_label, propertyId]
  );
  if (!row) return { year, row: null };
  return { year, row: withOwnerNameFallback([row])[0] };
}

// एका कोडखालील (मालकाच्या) सर्व मालमत्ता (portions) - प्रत्येकीचा स्वतंत्र
// due breakdown, मालमत्ता क्रं. नुसार क्रमवार (क्रमाने वसुल त्याच क्रमाने).
// कर जमा भरणे आता मालमत्ता-निहाय नव्हे तर कोड-निहाय (मालकाच्या सर्व
// मालमत्तांची बाकी एकत्रित) चालते - पहा utils/dueAllocation.js explodeDuesByPortion.
async function getDueBreakdownForCode(pool, propertyCode, yearId) {
  const [[year]] = await pool.query('SELECT * FROM financial_years WHERE id = ?', [yearId]);
  if (!year) return { year: null, portions: [] };

  const [portions] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name,
            COALESCE(cur.gharpatti, 0) AS current_gharpatti,
            COALESCE(cur.divabatti, 0) AS current_divabatti,
            COALESCE(cur.arogya, 0) AS current_arogya,
            COALESCE(cur.panipatti, 0) AS current_panipatti,
            COALESCE(prev.p_gharpatti, 0) AS previous_gharpatti,
            COALESCE(prev.p_divabatti, 0) AS previous_divabatti,
            COALESCE(prev.p_arogya, 0) AS previous_arogya,
            COALESCE(prev.p_panipatti, 0) AS previous_panipatti
     FROM property_master pm
     LEFT JOIN property_tax_assessment cur
       ON cur.property_id = pm.id AND cur.financial_year_id = ?
     LEFT JOIN (
       SELECT a.property_id,
              SUM(a.gharpatti) AS p_gharpatti, SUM(a.divabatti) AS p_divabatti,
              SUM(a.arogya) AS p_arogya, SUM(a.panipatti) AS p_panipatti
       FROM property_tax_assessment a
       JOIN financial_years fy ON fy.id = a.financial_year_id
       WHERE fy.year_label < ?
       GROUP BY a.property_id
     ) prev ON prev.property_id = pm.id
     WHERE pm.property_code = ?
     ORDER BY pm.malmata_no, pm.id`,
    [yearId, year.year_label, propertyCode]
  );
  return { year, portions: withOwnerNameFallback(portions) };
}

// कोडखालील सर्व मालमत्तांवर (कोणत्याही property_id वर) नोंदलेल्या त्याच
// receipt_type च्या पावत्यांची एकत्रित बेरीज.
async function getTotalPaidForCode(pool, propertyCode, receiptType) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS total FROM tax_payments p
     JOIN property_master pm ON pm.id = p.property_id
     WHERE pm.property_code = ? AND p.receipt_type = ?`,
    [propertyCode, receiptType]
  );
  return Number(row.total);
}

// Every property that has some due (current or previous) as of the given year.
async function getDueBreakdownBulk(pool, yearId) {
  const [[year]] = await pool.query('SELECT * FROM financial_years WHERE id = ?', [yearId]);
  if (!year) return { year: null, rows: [] };

  const [rows] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name,
            COALESCE(cur.gharpatti, 0) AS current_gharpatti,
            COALESCE(cur.divabatti, 0) AS current_divabatti,
            COALESCE(cur.arogya, 0) AS current_arogya,
            COALESCE(cur.panipatti, 0) AS current_panipatti,
            COALESCE(prev.p_gharpatti, 0) AS previous_gharpatti,
            COALESCE(prev.p_divabatti, 0) AS previous_divabatti,
            COALESCE(prev.p_arogya, 0) AS previous_arogya,
            COALESCE(prev.p_panipatti, 0) AS previous_panipatti
     FROM property_master pm
     LEFT JOIN property_tax_assessment cur
       ON cur.property_id = pm.id AND cur.financial_year_id = ?
     LEFT JOIN (
       SELECT a.property_id,
              SUM(a.gharpatti) AS p_gharpatti, SUM(a.divabatti) AS p_divabatti,
              SUM(a.arogya) AS p_arogya, SUM(a.panipatti) AS p_panipatti
       FROM property_tax_assessment a
       JOIN financial_years fy ON fy.id = a.financial_year_id
       WHERE fy.year_label < ?
       GROUP BY a.property_id
     ) prev ON prev.property_id = pm.id
     WHERE cur.id IS NOT NULL OR prev.p_gharpatti IS NOT NULL
     ORDER BY pm.property_code, pm.malmata_no`,
    [yearId, year.year_label]
  );
  return { year, rows: withOwnerNameFallback(rows) };
}

// Total ever paid by a property (all payments regardless of which
// financial_year_id they were recorded under - see dueAllocation.js for why).
// receiptType दिला तर फक्त त्या पावती-मालिकेच्या (घरपट्टी/पाणीपट्टी)
// payments मोजतो - FIFO वाटप आता गट-निहाय स्वतंत्र असल्याने आवश्यक.
async function getTotalPaid(pool, propertyId, receiptType = null) {
  const where = receiptType ? 'WHERE property_id = ? AND receipt_type = ?' : 'WHERE property_id = ?';
  const params = receiptType ? [propertyId, receiptType] : [propertyId];
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM tax_payments ${where}`,
    params
  );
  return Number(row.total);
}

// Total ever paid, for many properties at once (id -> total map).
async function getTotalPaidBulk(pool, propertyIds, receiptType = null) {
  if (propertyIds.length === 0) return {};
  const where = receiptType
    ? 'WHERE property_id IN (?) AND receipt_type = ?'
    : 'WHERE property_id IN (?)';
  const params = receiptType ? [propertyIds, receiptType] : [propertyIds];
  const [rows] = await pool.query(
    `SELECT property_id, COALESCE(SUM(amount), 0) AS total
     FROM tax_payments ${where} GROUP BY property_id`,
    params
  );
  const map = {};
  for (const r of rows) map[r.property_id] = Number(r.total);
  return map;
}

// घरपट्टी-गट व पाणीपट्टी-गट या दोन्ही स्वतंत्र FIFO वाटपांना एका सामायिक
// balance_by_component (जुन्याच 8-key आकाराचे) मध्ये एकत्र आणते - नमुना ९ क
// (कर मागणी बिल) सारख्या ठिकाणी दोन्ही गट मिळून एकत्र दाखवावे लागतात, तिथे
// receipt_type नुसार वेगळे बघायची गरज नाही.
function combineGroupAllocations(gharpattiAlloc, panipattiAlloc) {
  return {
    paid: { ...gharpattiAlloc.paid, ...panipattiAlloc.paid },
    balance: { ...gharpattiAlloc.balance, ...panipattiAlloc.balance },
    unallocated: { gharpatti: gharpattiAlloc.unallocated, panipatti: panipattiAlloc.unallocated },
  };
}

// एका मालमत्तेचे संपूर्ण (दोन्ही गट मिळून) वाटप - totalPaidGharpatti/
// totalPaidPanipatti आधीच माहीत असतील (उदा. bulk साठी) तर तेच वापरतो,
// नाहीतर स्वतः आणतो.
async function getCombinedAllocation(pool, propertyId, dues, { totalPaidGharpatti, totalPaidPanipatti } = {}) {
  const tpG = totalPaidGharpatti ?? await getTotalPaid(pool, propertyId, 'gharpatti');
  const tpP = totalPaidPanipatti ?? await getTotalPaid(pool, propertyId, 'panipatti');
  const gAlloc = allocate(dues, tpG, GHARPATTI_GROUP_ORDER);
  const pAlloc = allocate(dues, tpP, PANIPATTI_GROUP_ORDER);
  return combineGroupAllocations(gAlloc, pAlloc);
}

module.exports = {
  getDueBreakdownForProperty, getDueBreakdownForCode, getDueBreakdownBulk,
  getTotalPaid, getTotalPaidForCode, getTotalPaidBulk,
  combineGroupAllocations, getCombinedAllocation,
};
