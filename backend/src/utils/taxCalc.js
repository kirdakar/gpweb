// Ported from Form3.vb CalculateValues().
//
//   area_sqft (C_F)          = new_length * new_width, auto-filled by the UI
//   area_sqm  (C_M)          = area_sqft / 10.76, auto-filled by the UI
//   bhandvalimula_rs         = area_sqm * jamin_rate_used * gasara_rate * bharank, auto-filled by the UI
//   suggested_gharpatti      = (bhandvalimula_rs * karacha_rate) / 1000
//   gharpatti (house tax)    = whatever the caller supplies (see note below)
//   total_tax                = gharpatti + divabatti + arogya + panipatti
//
// IMPORTANT: area_sqft / area_sqm / bhandvalimula_rs and gharpatti are NOT
// force-derived here - the original VB form (Form3.vb) only ever hard-set
// TxtTOTAL.ReadOnly = True; every other calculated field was auto-filled by
// CalculateValues() on the relevant TextChanged events but stayed a plain,
// directly-editable textbox, so a clerk could type over an auto-computed
// value (e.g. to correct it, or for legacy rows with no L/W breakdown - see
// the 2023-2024 carry-over rows, which only ever had a lump-sum gharpatti
// with no area figures at all). Re-deriving these here from
// new_length/new_width/rates would silently discard that kind of manual
// correction/override on every save. So: trust whatever the client sends
// for these fields (the UI mirrors the same auto-fill-but-overridable
// behavior - see PropertyDetail.jsx's updateAssessment()), and only
// total_tax is truly computed server-side, matching TxtTOTAL.ReadOnly.

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function calculateAssessment(input) {
  const newLength = Number(input.new_length) || 0;
  const newWidth = Number(input.new_width) || 0;
  const jaminRateUsed = Number(input.jamin_rate_used) || 0;
  const gasaraRate = Number(input.gasara_rate) || 0;
  const bharank = Number(input.bharank) || 0;
  const karachaRate = Number(input.karacha_rate) || 0;

  const areaSqft = round2(input.area_sqft);
  const areaSqm = round2(input.area_sqm);
  const bhandvalimulaRs = round2(input.bhandvalimula_rs);
  const suggestedGharpatti = round2((bhandvalimulaRs * karachaRate) / 1000);

  const gharpatti = round2(input.gharpatti);
  const divabatti = round2(input.divabatti);
  const arogya = round2(input.arogya);
  const panipatti = round2(input.panipatti);

  const totalTax = round2(gharpatti + divabatti + arogya + panipatti);

  return {
    new_length: newLength,
    new_width: newWidth,
    area_sqft: areaSqft,
    area_sqm: areaSqm,
    jamin_rate_used: jaminRateUsed,
    gasara_rate: gasaraRate,
    bharank,
    bhandvalimula_rs: bhandvalimulaRs,
    karacha_rate: karachaRate,
    suggested_gharpatti: suggestedGharpatti,
    gharpatti,
    divabatti,
    arogya,
    panipatti,
    total_tax: totalTax,
  };
}

module.exports = { calculateAssessment, round2 };
