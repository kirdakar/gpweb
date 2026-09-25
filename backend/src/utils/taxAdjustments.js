// घरपट्टी सूट/दंड नियम (tax_adjustments) येणे-बाकीच्या ओळींवर लावतो.
// ओळी: dueBreakdown.js/computeOldNewComparison मधून येणाऱ्या - प्रत्येक मालमत्तेची
// previous_X / current_X (X = gharpatti, divabatti, arogya, panipatti). निकालात
// previous_X/current_X = निव्वळ (मूळ - सूट + दंड) बनतात, आणि शेजारी orig_*/discount_*/penalty_*
// उपलब्ध राहतात (नमुना ९क, कर जमा भरणे स्क्रीनवर वेगळे दाखवण्यासाठी).
const { round2 } = require('./dueAllocation');

const COMPONENTS = ['gharpatti', 'divabatti', 'arogya', 'panipatti'];
const BUCKETS = ['previous', 'current'];
const CELL_KEYS = BUCKETS.flatMap((b) => COMPONENTS.map((c) => `${b}_${c}`));
// aggregatePortions इ. मध्ये बेरीज करण्यासाठी सर्व अतिरिक्त किल्ल्या
const ADJUSTMENT_KEYS = CELL_KEYS.flatMap((k) => [`orig_${k}`, `discount_${k}`, `penalty_${k}`]);

async function loadRules(db, yearId) {
  const [rules] = await db.query(
    'SELECT * FROM tax_adjustments WHERE financial_year_id = ? AND is_active = 1 ORDER BY id', [yearId]
  );
  return rules;
}

function targetCells(rule) {
  const buckets = rule.applies_to === 'दोन्ही' ? BUCKETS : [rule.applies_to === 'मागील' ? 'previous' : 'current'];
  const comps = COMPONENTS.filter((c) => rule[`on_${c}`]);
  return buckets.flatMap((b) => comps.map((c) => `${b}_${c}`));
}

// rows यांना बदलत नाही - नवीन प्रती परत करतो. rules रिकामे असले तरी orig_* जोडतो.
function applyTaxAdjustments(rows, rules) {
  const out = rows.map((r) => {
    const n = { ...r };
    for (const k of CELL_KEYS) {
      n[`orig_${k}`] = Number(r[k] || 0);
      n[`discount_${k}`] = 0;
      n[`penalty_${k}`] = 0;
    }
    return n;
  });
  const personKey = (r) => (r.property_code != null ? `c${r.property_code}` : `p${r.property_id}`);

  for (const rule of rules || []) {
    const cells = targetCells(rule);
    const field = rule.kind === 'सूट' ? 'discount' : 'penalty';
    const eligible = out.filter((r) => rule.scope === 'सर्व' || String(r.property_code) === String(rule.property_code));
    if (cells.length === 0 || eligible.length === 0) continue;
    const value = Number(rule.value);

    if (rule.mode === 'टक्के') {
      for (const r of eligible) for (const k of cells) r[`${field}_${k}`] += round2((r[`orig_${k}`] * value) / 100);
    } else {
      // रक्कम: प्रत्येक व्यक्तीला (कोडाला) ही रक्कम - त्या व्यक्तीच्या निवडलेल्या रकान्यांत मूळ रकमेच्या प्रमाणात वाटतो
      const groups = new Map();
      for (const r of eligible) {
        const key = personKey(r);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      for (const g of groups.values()) {
        const totalBase = g.reduce((s, r) => s + cells.reduce((t, k) => t + r[`orig_${k}`], 0), 0);
        if (totalBase <= 0) continue;
        for (const r of g) for (const k of cells) r[`${field}_${k}`] += round2((value * r[`orig_${k}`]) / totalBase);
      }
    }
  }

  for (const r of out) {
    let discountTotal = 0;
    let penaltyTotal = 0;
    for (const k of CELL_KEYS) {
      const orig = r[`orig_${k}`];
      const disc = round2(Math.min(r[`discount_${k}`], orig)); // सूट मूळ रकमेपेक्षा जास्त नाही
      const pen = round2(r[`penalty_${k}`]);
      r[`discount_${k}`] = disc;
      r[`penalty_${k}`] = pen;
      r[k] = round2(orig - disc + pen);
      discountTotal += disc;
      penaltyTotal += pen;
    }
    r.discount_total = round2(discountTotal);
    r.penalty_total = round2(penaltyTotal);
    if (r.previous_due !== undefined) r.previous_due = round2(COMPONENTS.reduce((s, c) => s + r[`previous_${c}`], 0));
    if (r.current_due !== undefined) r.current_due = round2(COMPONENTS.reduce((s, c) => s + r[`current_${c}`], 0));
  }
  return out;
}

async function applyRulesForYear(db, rows, yearId, { skip = false } = {}) {
  if (skip) return applyTaxAdjustments(rows, []);
  return applyTaxAdjustments(rows, await loadRules(db, yearId));
}

// वर्षनिहाय (मागील वर्षांच्या) मूळ ओळी, मालमत्तेच्या निव्वळ मागील बाकीशी जुळेपर्यंत प्रमाणात बदलतो -
// due-detail (वर्षवार तपशील) ची बेरीज due-summary शी जुळावी म्हणून. शेवटच्या वर्षात पैशांचा फरक.
function scaleYearRowsToNet(yearRows, portions, selectedLabel) {
  const rows = yearRows.map((r) => ({ ...r }));
  for (const portion of portions) {
    for (const c of COMPONENTS) {
      const target = Number(portion[`previous_${c}`] || 0);
      const mine = rows
        .filter((r) => r.property_id === portion.property_id && r.year_label < selectedLabel)
        .sort((a, b) => (a.year_label < b.year_label ? -1 : 1));
      const sumOrig = mine.reduce((s, r) => s + Number(r[c] || 0), 0);
      if (mine.length === 0 || sumOrig <= 0 || Math.abs(sumOrig - target) < 0.005) continue;
      let assigned = 0;
      mine.forEach((r, i) => {
        const v = i === mine.length - 1 ? round2(target - assigned) : round2((Number(r[c]) * target) / sumOrig);
        assigned = round2(assigned + v);
        r[c] = v;
      });
    }
  }
  return rows;
}

module.exports = { COMPONENTS, CELL_KEYS, ADJUSTMENT_KEYS, loadRules, applyTaxAdjustments, applyRulesForYear, scaleYearRowsToNet };
