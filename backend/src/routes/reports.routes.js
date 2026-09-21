const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { fallbackOwnerName, withOwnerNameFallback } = require('../utils/ownerName');
const { allocate, round2, GROUP_ORDER_BY_TYPE } = require('../utils/dueAllocation');
const { getTotalPaidBulk, getDueBreakdownForProperty } = require('../utils/dueBreakdown');

const router = express.Router();
router.use(requireAuth);

// Full property + tax listing for one year (was: ananadnagar_list.rpt / anandnagar.rpt)
router.get('/property-list', async (req, res) => {
  const yearId = req.query.yearId;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });
  const [rows] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name, pm.bhogvatdar,
            pt.par_name AS construction_type_name,
            a.new_length, a.new_width, a.area_sqft, a.area_sqm, a.bhandvalimula_rs, a.karacha_rate,
            a.gharpatti, a.divabatti, a.arogya, a.panipatti, a.total_tax, a.gov_status
     FROM property_tax_assessment a
     JOIN property_master pm ON pm.id = a.property_id
     LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     WHERE a.financial_year_id = ?
     ORDER BY pm.property_code, pm.malmata_no`,
    [yearId]
  );
  res.json(withOwnerNameFallback(rows));
});

// नमुना नं. ८ - आकारणी यादी (Assessment Register), the statutory form
// (was: access_anandnagar_report.rpt). Needs the full set of fields the
// official form's 27 numbered columns require - most already exist on
// property_master / property_tax_assessment from the other reports, plus
// a few (particulars, milkat_year, bhogvatdar, jamin_rate_used, gasara_rate,
// bharank, narration) that aren't in property-list's leaner column set.
router.get('/assessment-register', async (req, res) => {
  const yearId = req.query.yearId;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });
  const [rows] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name, pm.bhogvatdar,
            pm.particulars, pm.milkat_year,
            pt.par_name AS construction_type_name,
            a.new_length, a.new_width, a.area_sqft, a.area_sqm,
            a.jamin_rate_used, a.gasara_rate, a.bharank, a.bhandvalimula_rs, a.karacha_rate,
            a.gharpatti, a.divabatti, a.arogya, a.panipatti, a.total_tax, a.narration
     FROM property_tax_assessment a
     JOIN property_master pm ON pm.id = a.property_id
     LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     WHERE a.financial_year_id = ?
     ORDER BY pm.property_code, pm.malmata_no`,
    [yearId]
  );
  res.json(withOwnerNameFallback(rows));
});

// Arrears report (was: ananadnagar_oldNew_list.rpt - a plain two-year
// side-by-side comparison). Redesigned per user request: pick one "चालू
// वर्ष" (current year) and show, per property portion, a full घरपट्टी /
// दिवाबत्ती / आरोग्य कर / पाणीपट्टी / एकूण breakdown for three groups:
//   जुनी (previous_*)  = SUM(component) over every year that comes
//                         chronologically before the selected year
//   नविन (current_*)   = that component for the selected year itself
//   एकूण बाकी (total_*) = previous_* + current_*
// "Previous" is determined by year_label ordering (works for the "YYYY-YYYY"
// format used throughout - plain string comparison sorts these correctly).
// There is no payment/receipt ledger in this system, so "बाकी" here means
// total assessed tax, not tax minus amount actually paid.
router.get('/old-new-comparison', async (req, res) => {
  const yearId = req.query.yearId;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });

  const [[year]] = await pool.query('SELECT * FROM financial_years WHERE id = ?', [yearId]);
  if (!year) return res.status(404).json({ error: 'Financial year not found' });

  const [rows] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name,
            COALESCE(cur.gharpatti, 0) AS current_gharpatti,
            COALESCE(cur.divabatti, 0) AS current_divabatti,
            COALESCE(cur.arogya, 0) AS current_arogya,
            COALESCE(cur.panipatti, 0) AS current_panipatti,
            COALESCE(cur.total_tax, 0) AS current_due,
            COALESCE(prev.p_gharpatti, 0) AS previous_gharpatti,
            COALESCE(prev.p_divabatti, 0) AS previous_divabatti,
            COALESCE(prev.p_arogya, 0) AS previous_arogya,
            COALESCE(prev.p_panipatti, 0) AS previous_panipatti,
            COALESCE(prev.p_total, 0) AS previous_due
     FROM property_master pm
     LEFT JOIN property_tax_assessment cur
       ON cur.property_id = pm.id AND cur.financial_year_id = ?
     LEFT JOIN (
       SELECT a.property_id,
              SUM(a.gharpatti) AS p_gharpatti, SUM(a.divabatti) AS p_divabatti,
              SUM(a.arogya) AS p_arogya, SUM(a.panipatti) AS p_panipatti, SUM(a.total_tax) AS p_total
       FROM property_tax_assessment a
       JOIN financial_years fy ON fy.id = a.financial_year_id
       WHERE fy.year_label < ?
       GROUP BY a.property_id
     ) prev ON prev.property_id = pm.id
     WHERE cur.id IS NOT NULL OR prev.p_total IS NOT NULL
     ORDER BY pm.property_code, pm.malmata_no`,
    [yearId, year.year_label]
  );

  // एकूण बाकी (total_*) = previous_* + current_*, computed here so the
  // client doesn't have to redo float addition on strings from MySQL.
  const withTotals = withOwnerNameFallback(rows).map((r) => ({
    ...r,
    total_gharpatti: Number(r.previous_gharpatti) + Number(r.current_gharpatti),
    total_divabatti: Number(r.previous_divabatti) + Number(r.current_divabatti),
    total_arogya: Number(r.previous_arogya) + Number(r.current_arogya),
    total_panipatti: Number(r.previous_panipatti) + Number(r.current_panipatti),
    total_due: Number(r.previous_due) + Number(r.current_due),
  }));

  // जमा रक्कम (collected so far) आणि उर्वरित/येणे बाकी - प्रत्येक
  // मालमत्तेसाठी आजवर भरलेल्या सर्व पावत्यांची बेरीज विरुद्ध एकूण देय.
  const paidMap = await getTotalPaidBulk(pool, withTotals.map((r) => r.property_id));
  const withPayments = withTotals.map((r) => {
    const totalPaid = round2(paidMap[r.property_id] || 0);
    return {
      ...r,
      collected_amount: totalPaid,
      remaining_due: round2(Math.max(0, r.total_due - totalPaid)),
    };
  });

  res.json({ year, rows: withPayments });
});

// Owner-level roll-up (was: anandoldnew_total, rebuilt on demand in Form4;
// here it's always live via property_tax_summary_view)
router.get('/summary', async (req, res) => {
  const yearId = req.query.yearId;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });
  const [rows] = await pool.query(
    `SELECT * FROM property_tax_summary_view WHERE financial_year_id = ? ORDER BY property_code`,
    [yearId]
  );
  res.json(withOwnerNameFallback(rows));
});

// Individual tax-demand notice (was: ananadnagar_kar_magani_main.rpt),
// one portion at a time.
router.get('/tax-demand', async (req, res) => {
  const { propertyId, yearId } = req.query;
  if (!propertyId || !yearId) return res.status(400).json({ error: 'propertyId and yearId are required' });

  const [[property]] = await pool.query(
    `SELECT pm.*, pt.par_name AS construction_type_name
     FROM property_master pm LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     WHERE pm.id = ?`,
    [propertyId]
  );
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const [[assessment]] = await pool.query(
    `SELECT a.*, fy.year_label FROM property_tax_assessment a
     JOIN financial_years fy ON fy.id = a.financial_year_id
     WHERE a.property_id = ? AND a.financial_year_id = ?`,
    [propertyId, yearId]
  );

  res.json({ property: { ...property, owner_name: fallbackOwnerName(property) }, assessment: assessment || null });
});

// All portions for one owner (कोड), combined demand notice - mirrors
// Form4's owner-picker report flow.
router.get('/tax-demand-by-code', async (req, res) => {
  const { code, yearId } = req.query;
  if (!code || !yearId) return res.status(400).json({ error: 'code and yearId are required' });

  const [portions] = await pool.query(
    `SELECT pm.id AS property_id, pm.property_code, pm.srno, pm.malmata_no, pm.owner_name, pm.bhogvatdar,
            pt.par_name AS construction_type_name,
            a.gharpatti, a.divabatti, a.arogya, a.panipatti, a.total_tax
     FROM property_master pm
     LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     LEFT JOIN property_tax_assessment a ON a.property_id = pm.id AND a.financial_year_id = ?
     WHERE pm.property_code = ?
     ORDER BY pm.malmata_no`,
    [yearId, code]
  );
  res.json(withOwnerNameFallback(portions));
});

// जमा पावती रिपोर्ट: निवडलेल्या वर्षात नोंदवलेल्या सर्व पावत्यांची यादी,
// प्रत्येक पावतीद्वारे नेमकी कोणत्या घटकात किती रक्कम वसूल झाली याच्या
// तपशीलासह. घरपट्टी व पाणीपट्टी आता दोन स्वतंत्र पावती-मालिका (receipt_type)
// असल्याने cumulative वाटप प्रत्येक (property, receipt_type) जोडीसाठी
// वेगळे काढतो - एका गटाची पावती दुसऱ्या गटाच्या बाकीला स्पर्श करत नाही.
router.get('/payment-receipts', async (req, res) => {
  const yearId = req.query.yearId;
  if (!yearId) return res.status(400).json({ error: 'yearId is required' });

  // यादीत दाखवायच्या पावत्या: फक्त या वर्षात नोंदवलेल्या.
  const [wantedPayments] = await pool.query(
    `SELECT p.*, fy.year_label, pm.owner_name, pm.property_code, pm.srno, pm.malmata_no
     FROM tax_payments p
     JOIN financial_years fy ON fy.id = p.financial_year_id
     JOIN property_master pm ON pm.id = p.property_id
     WHERE p.financial_year_id = ?
     ORDER BY p.payment_date, p.id`,
    [yearId]
  );
  if (wantedPayments.length === 0) return res.json([]);

  const propertyIds = [...new Set(wantedPayments.map((p) => p.property_id))];

  // वाटप बरोबर येण्यासाठी - एखाद्या मालमत्तेच्या पूर्वीच्या वर्षांतही
  // पावत्या असू शकतात, त्यामुळे प्रत्येक मालमत्तेच्या *सर्व* पावत्या
  // (कोणत्याही वर्षातील) कालक्रमाने घेऊन cumulative वाटप काढतो, आणि
  // त्यातून फक्त या वर्षातल्या पावत्यांचे वाटप दाखवतो. की = property_id|receipt_type.
  const [allPayments] = await pool.query(
    `SELECT id, property_id, receipt_type, payment_date, amount FROM tax_payments
     WHERE property_id IN (?) ORDER BY payment_date, id`,
    [propertyIds]
  );
  const allByGroup = new Map();
  for (const p of allPayments) {
    const key = `${p.property_id}|${p.receipt_type}`;
    if (!allByGroup.has(key)) allByGroup.set(key, []);
    allByGroup.get(key).push(p);
  }
  const wantedIds = new Set(wantedPayments.map((p) => p.id));
  const detailsById = new Map(wantedPayments.map((p) => [p.id, p]));
  const duesByProperty = new Map();

  const receipts = [];
  for (const [key, groupPayments] of allByGroup) {
    const [propertyIdStr, receiptType] = key.split('|');
    const propertyId = Number(propertyIdStr);
    const order = GROUP_ORDER_BY_TYPE[receiptType];
    if (!duesByProperty.has(propertyId)) {
      duesByProperty.set(propertyId, (await getDueBreakdownForProperty(pool, propertyId, yearId)).row);
    }
    const dues = duesByProperty.get(propertyId);

    let cumulative = 0;
    for (const p of groupPayments) {
      const before = allocate(dues || {}, cumulative, order);
      const after = allocate(dues || {}, cumulative + Number(p.amount), order);
      cumulative += Number(p.amount);

      if (!wantedIds.has(p.id)) continue; // this property has payments outside the requested year too
      const covered = {};
      for (const compKey of Object.keys(after.paid)) {
        covered[compKey] = round2(after.paid[compKey] - before.paid[compKey]);
      }
      // येणे बाकी (हेड प्रमाणे) - या पावतीनंतर उरलेली बाकी, मागील+चालू
      // दोन्ही एकत्र करून त्या receipt_type च्या घटकांसाठी.
      const remaining = {};
      const remainingComponents = receiptType === 'panipatti' ? ['panipatti'] : ['gharpatti', 'divabatti', 'arogya'];
      for (const component of remainingComponents) {
        remaining[`remaining_${component}`] = round2(
          (after.balance[`previous_${component}`] || 0) + (after.balance[`current_${component}`] || 0)
        );
      }
      const detail = detailsById.get(p.id);
      receipts.push({
        ...detail,
        owner_name: fallbackOwnerName(detail),
        extra_charges_total: round2(
          Number(detail.khuli_jaga_amount || 0) + Number(detail.notice_fee_amount || 0)
          + Number(detail.warrant_fee_amount || 0) + Number(detail.other_amount || 0)
        ),
        ...covered,
        ...remaining,
      });
    }
  }

  receipts.sort((a, b) => (a.payment_date < b.payment_date ? -1 : a.payment_date > b.payment_date ? 1 : a.id - b.id));
  res.json(receipts);
});

module.exports = router;
