// Mirrors backend/src/utils/taxCalc.js (ported from Form3.vb CalculateValues)
// so the entry form can show live totals before saving.
//
// gharpatti is NOT auto-derived from the area formula - many legacy rows
// (2023-2024 carry-over data) only ever had a lump-sum figure with no area
// breakdown, so forcing a recalculation on every keystroke would silently
// zero those out when re-saved. `suggested_gharpatti` is offered instead;
// the form copies it into the editable gharpatti field only on request.
export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function calculateAssessment(input) {
  const newLength = Number(input.new_length) || 0;
  const newWidth = Number(input.new_width) || 0;
  const jaminRateUsed = Number(input.jamin_rate_used) || 0;
  const gasaraRate = Number(input.gasara_rate) || 0;
  const bharank = Number(input.bharank) || 0;
  const karachaRate = Number(input.karacha_rate) || 0;

  const areaSqft = round2(newLength * newWidth);
  const areaSqm = round2(areaSqft / 10.76);
  const bhandvalimulaRs = round2(areaSqm * jaminRateUsed * gasaraRate * bharank);
  const suggestedGharpatti = round2((bhandvalimulaRs * karachaRate) / 1000);

  const gharpatti = round2(input.gharpatti);
  const divabatti = round2(input.divabatti);
  const arogya = round2(input.arogya);
  const panipatti = round2(input.panipatti);

  const totalTax = round2(gharpatti + divabatti + arogya + panipatti);

  return {
    area_sqft: areaSqft,
    area_sqm: areaSqm,
    bhandvalimula_rs: bhandvalimulaRs,
    suggested_gharpatti: suggestedGharpatti,
    gharpatti,
    total_tax: totalTax,
  };
}
