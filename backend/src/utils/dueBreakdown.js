// Computes घरपट्टी/दिवाबत्ती/आरोग्य/पाणीपट्टी dues split into "previous"
// (every year chronologically before the given one, combined) and
// "current" (the given year itself) - the same जुनी/नविन split used by the
// थकबाकी/येणे बाकी report. Shared so payment entry, receipts, and reports
// all compute it identically.
const { withOwnerNameFallback } = require('./ownerName');

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
async function getTotalPaid(pool, propertyId) {
  const [[row]] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM tax_payments WHERE property_id = ?',
    [propertyId]
  );
  return Number(row.total);
}

// Total ever paid, for many properties at once (id -> total map).
async function getTotalPaidBulk(pool, propertyIds) {
  if (propertyIds.length === 0) return {};
  const [rows] = await pool.query(
    `SELECT property_id, COALESCE(SUM(amount), 0) AS total
     FROM tax_payments WHERE property_id IN (?) GROUP BY property_id`,
    [propertyIds]
  );
  const map = {};
  for (const r of rows) map[r.property_id] = Number(r.total);
  return map;
}

module.exports = { getDueBreakdownForProperty, getDueBreakdownBulk, getTotalPaid, getTotalPaidBulk };
