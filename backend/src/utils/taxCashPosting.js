// कर जमा भरणे (tax_payments) -> रोकड वही (नमुना ५) मध्ये आपोआप जमा नोंद.
// एक पावती = घटकनिहाय (घरपट्टी/दिवाबत्ती/आरोग्य/पाणीपट्टी + खुली जागा/नोटीस/वारंट/इतर)
// जितके शीर्ष तितक्या cash_book_entries ओळी, सर्व tax_payment_id ने पावतीशी जोडलेल्या
// (पावती मिटवल्यास ON DELETE CASCADE ने त्याही मिटतात). रक्कम पुन्हा टाईप करावी लागत नाही.
const { round2 } = require('./dueAllocation');

// घटक -> लेखाशीर्ष कोड (नमुना १ वरील जमा शीर्षे)
const COMPONENT_HEAD = {
  gharpatti: '1.a.1',   // मालमत्ता कर, जमिनी व इमारती यावरील कर
  divabatti: '1.a.2',   // दिवाबत्ती कर
  arogya: '1.a.3',      // स्वच्छता (आरोग्य) कर
  panipatti: '1.b.4',   // पाणीपट्टी
};
const OTHER_HEAD = '1.b.13'; // इतर जमा - खुली जागा/नोटीस/वारंट/इतर फी
const COMPONENT_LABEL = { gharpatti: 'घरपट्टी', divabatti: 'दिवाबत्ती कर', arogya: 'आरोग्य कर', panipatti: 'पाणीपट्टी' };

// payment: tax_payments ओळ (+ property_code), covered: घटकनिहाय या पावतीने भरलेली रक्कम
// dues: पावतीच्या वेळची एकत्रित देय (aggregatePortions) - penalty_* वरून पावतीतील दंडाचा भाग वेगळ्या शीर्षावर जातो
async function postTaxPaymentToCashBook(conn, payment, covered, userId, dues) {
  const codes = [...Object.values(COMPONENT_HEAD), OTHER_HEAD];
  const [heads] = await conn.query('SELECT id, code FROM ledger_heads WHERE code IN (?)', [codes]);
  const headId = Object.fromEntries(heads.map((h) => [h.code, h.id]));

  const lines = [];
  let penaltyPaid = 0;
  for (const [component, code] of Object.entries(COMPONENT_HEAD)) {
    // covered च्या किल्ल्या 'previous_gharpatti'/'current_gharpatti' अशा (मागील+चालू) - दोन्ही मिळवतो
    let compTotal = 0;
    let compPenalty = 0;
    for (const k of Object.keys(covered || {})) {
      if (!(k === component || k.endsWith(`_${component}`))) continue;
      const paid = Number(covered[k] || 0);
      compTotal += paid;
      // या रकान्यातील दंडाचा हिस्सा = भरलेली रक्कम x (रकान्यातील दंड / निव्वळ देय)
      const net = Number(dues && dues[k]) || 0;
      const pen = Number(dues && dues[`penalty_${k}`]) || 0;
      if (net > 0 && pen > 0) compPenalty += paid * Math.min(1, pen / net);
    }
    compTotal = round2(compTotal);
    compPenalty = Math.min(round2(compPenalty), compTotal);
    penaltyPaid = round2(penaltyPaid + compPenalty);
    const taxPart = round2(compTotal - compPenalty);
    if (taxPart > 0 && headId[code]) lines.push({ headId: headId[code], amount: taxPart, label: COMPONENT_LABEL[component] });
  }
  if (penaltyPaid > 0 && headId[OTHER_HEAD]) lines.push({ headId: headId[OTHER_HEAD], amount: penaltyPaid, label: 'दंड (कर थकबाकी/विलंब)' });
  const extras = round2(Number(payment.khuli_jaga_amount || 0) + Number(payment.notice_fee_amount || 0)
    + Number(payment.warrant_fee_amount || 0) + Number(payment.other_amount || 0));
  if (extras > 0 && headId[OTHER_HEAD]) lines.push({ headId: headId[OTHER_HEAD], amount: extras, label: 'खुली जागा/नोटीस/वारंट/इतर फी' });

  // वाटपात न बसलेला (अपवादात्मक) फरक असल्यास मुख्य शीर्षावर टाकतो, जेणेकरून रोकड वही पावतीशी जुळेल
  const expected = round2(Number(payment.amount) + extras);
  const posted = round2(lines.reduce((s, l) => s + l.amount, 0));
  if (expected - posted > 0.004) {
    const fallback = payment.receipt_type === 'panipatti' ? COMPONENT_HEAD.panipatti : COMPONENT_HEAD.gharpatti;
    if (headId[fallback]) lines.push({ headId: headId[fallback], amount: round2(expected - posted), label: 'इतर' });
  }

  // नोंदीत कोडसह मिळकतदाराचे नाव (कोडमधील पहिली नाव असलेली मालमत्ता)
  const [[own]] = await conn.query(
    "SELECT owner_name FROM property_master WHERE property_code = ? AND owner_name IS NOT NULL AND owner_name <> '' ORDER BY id LIMIT 1",
    [payment.property_code]
  );
  const who = own ? ` - ${own.owner_name}` : '';

  const prefix = payment.receipt_type === 'panipatti' ? 'पा' : 'घ';
  const mode = payment.payment_mode === 'cash' ? 'रोख' : 'धनादेश';
  const date = typeof payment.payment_date === 'string' ? payment.payment_date.slice(0, 10) : payment.payment_date_str;
  for (const l of lines) {
    await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode,
          reference_no, reference_date, narration, tax_payment_id, created_by)
       VALUES (?, ?, ?, 'जमा', 'मुख्य', ?, ?, ?, ?, ?, ?, ?)`,
      [payment.financial_year_id, date, l.headId, l.amount, mode, `${prefix}-${payment.receipt_no}`, date,
        `कर जमा - ${l.label} - कोड ${payment.property_code}${who} - पावती ${prefix}-${payment.receipt_no}`, payment.id, userId || null]
    );
  }
  return lines.length;
}

module.exports = { postTaxPaymentToCashBook };
