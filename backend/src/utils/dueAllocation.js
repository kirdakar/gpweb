// Payment allocation logic (कर जमा वाटप), per explicit user requirement:
// a collected amount is first applied against मागील बाकी (all prior years'
// dues, combined), in the order घरपट्टी -> दिवाबत्ती -> आरोग्यकर ->
// पाणीपट्टी, and only once each of those is fully covered does the
// remainder flow into चालू वर्षातील (current/selected year's) dues, in the
// same component order.
const ALLOCATION_ORDER = [
  'previous_gharpatti', 'previous_divabatti', 'previous_arogya', 'previous_panipatti',
  'current_gharpatti', 'current_divabatti', 'current_arogya', 'current_panipatti',
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// dues: { previous_gharpatti, previous_divabatti, previous_arogya, previous_panipatti,
//         current_gharpatti, current_divabatti, current_arogya, current_panipatti }
// totalPaid: cumulative amount to walk through the buckets in ALLOCATION_ORDER
// returns: { paid: {...same keys}, balance: {...same keys}, unallocated }
//   unallocated = any amount left over after every known due is fully paid
//   (an advance/overpayment) - surfaced rather than silently dropped.
function allocate(dues, totalPaid) {
  let remaining = round2(totalPaid);
  const paid = {};
  const balance = {};
  for (const key of ALLOCATION_ORDER) {
    const due = round2(dues[key] || 0);
    const pay = round2(Math.min(remaining, due));
    paid[key] = pay;
    balance[key] = round2(due - pay);
    remaining = round2(remaining - pay);
    if (remaining < 0) remaining = 0;
  }
  return { paid, balance, unallocated: remaining };
}

function sumDue(dues) {
  return round2(ALLOCATION_ORDER.reduce((s, k) => s + (Number(dues[k]) || 0), 0));
}

function sumAllocation(alloc) {
  return round2(ALLOCATION_ORDER.reduce((s, k) => s + (Number(alloc[k]) || 0), 0));
}

module.exports = { ALLOCATION_ORDER, allocate, sumDue, sumAllocation, round2 };
