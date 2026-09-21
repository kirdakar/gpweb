// Payment allocation logic (कर जमा वाटप), per explicit user requirement:
// a collected amount is first applied against मागील बाकी (all prior years'
// dues, combined), then चालू वर्षातील (current/selected year's) dues.
//
// नमुना नं. १० प्रत्यक्ष कागदी पावती पुस्तके दोन स्वतंत्र मालिका आहेत -
// घरपट्टी पावती (घरपट्टी+दिवाबत्ती+आरोग्य कर) आणि पाणीपट्टी पावती (फक्त
// पाणीपट्टी) - म्हणून एकच सामायिक ALLOCATION_ORDER ऐवजी आता दोन गट-निहाय
// order आहेत; प्रत्येक गटाचे वाटप त्या गटाच्या payments च्या cumulative
// रकमेवरच (दुसऱ्या गटाच्या पावत्या न मोजता) चालते (पहा dueBreakdown.js).
const GHARPATTI_GROUP_ORDER = [
  'previous_gharpatti', 'previous_divabatti', 'previous_arogya',
  'current_gharpatti', 'current_divabatti', 'current_arogya',
];
const PANIPATTI_GROUP_ORDER = ['previous_panipatti', 'current_panipatti'];
// संपूर्ण यादी - नमुना ९ क (कर मागणी बिल) सारख्या दोन्ही गट एकत्र
// दाखवणाऱ्या ठिकाणी sumDue साठी वापरतो.
const ALLOCATION_ORDER = [...GHARPATTI_GROUP_ORDER, ...PANIPATTI_GROUP_ORDER];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// dues: { previous_gharpatti, previous_divabatti, previous_arogya, previous_panipatti,
//         current_gharpatti, current_divabatti, current_arogya, current_panipatti }
// totalPaid: cumulative amount (त्याच गटाच्या पावत्यांची बेरीज) to walk
// through the buckets in `order` (डीफॉल्ट: संपूर्ण यादी, मागचा वापर मोडू नये म्हणून)
// returns: { paid: {...त्या order च्या keys}, balance: {...same}, unallocated }
//   unallocated = any amount left over after every known due is fully paid
//   (an advance/overpayment) - surfaced rather than silently dropped.
function allocate(dues, totalPaid, order = ALLOCATION_ORDER) {
  let remaining = round2(totalPaid);
  const paid = {};
  const balance = {};
  for (const key of order) {
    const due = round2(dues[key] || 0);
    const pay = round2(Math.min(remaining, due));
    paid[key] = pay;
    balance[key] = round2(due - pay);
    remaining = round2(remaining - pay);
    if (remaining < 0) remaining = 0;
  }
  return { paid, balance, unallocated: remaining };
}

function sumDue(dues, order = ALLOCATION_ORDER) {
  return round2(order.reduce((s, k) => s + (Number(dues[k]) || 0), 0));
}

function sumAllocation(alloc, order = ALLOCATION_ORDER) {
  return round2(order.reduce((s, k) => s + (Number(alloc[k]) || 0), 0));
}

// गटाच्या नावावरून (receipt_type) त्याचा order array द्यायला - राऊटमध्ये
// वारंवार if/else लिहावे लागू नये म्हणून.
const GROUP_ORDER_BY_TYPE = { gharpatti: GHARPATTI_GROUP_ORDER, panipatti: PANIPATTI_GROUP_ORDER };

// एका कोडखाली अनेक मालमत्ता (portions) असतील तर त्या सर्वांची बाकी
// एकत्रित करून, "प्रत्येक घटकासाठी आधी सर्व मागील मालमत्तांचे मागील बाकी,
// मग सर्वांचे चालू" या क्रमाने - पण कोणती नेमकी मालमत्ता आधी भरली गेली हे
// (क्रमाने वसुल) ठरवण्यासाठी - प्रत्येक (घटक, मालमत्ता) जोडीला स्वतंत्र की
// देऊन allocate() लाच (न बदलता) चालवतो. एकाच मालमत्तेचा कोड असेल तर हे
// जुन्या प्रति-मालमत्ता वागणुकीशी आपसूक जुळते (फक्त एकच मालमत्ता=एकच की गट).
// portions: मालमत्ता क्रं. नुसार क्रमवार याद्या (त्याच क्रमाने वसुल होते).
function explodeDuesByPortion(portions, baseOrder) {
  const dues = {};
  const order = [];
  for (const component of baseOrder) {
    for (const portion of portions) {
      const key = `${component}::${portion.property_id}`;
      dues[key] = portion[component];
      order.push(key);
    }
  }
  return { dues, order };
}

// exploded allocate() च्या paid/balance मधील "component::propertyId" की
// पुन्हा साध्या component-निहाय बेरजेत (सर्व मालमत्ता मिळून) आणते - due-summary
// सारख्या ठिकाणी जिथे फक्त एकत्रित आकडे दाखवायचे असतात तिथे वापरतो.
function collapseByComponent(alloc, baseOrder) {
  const paid = {};
  const balance = {};
  for (const component of baseOrder) {
    paid[component] = round2(
      Object.keys(alloc.paid || {}).filter((k) => k.startsWith(`${component}::`))
        .reduce((s, k) => s + alloc.paid[k], 0)
    );
    balance[component] = round2(
      Object.keys(alloc.balance || {}).filter((k) => k.startsWith(`${component}::`))
        .reduce((s, k) => s + alloc.balance[k], 0)
    );
  }
  return { paid, balance, unallocated: alloc.unallocated };
}

// "मागील बाकी"/"चालू बाकी"/"जमा" या एकत्रित आकड्यांचा वर्षवार, मालमत्ता
// क्रं.-वार, हेड-वार तपशील दाखवण्यासाठी - previous_X (मालमत्तानिहाय
// एकत्रित बाकी) चा प्रत्येक घटक त्या मालमत्तेच्या वैयक्तिक मागील वर्षांमध्ये
// (जुने वर्ष आधी) फोडतो, त्याच क्रमांकाच्या जागी टाकून (allocate() च्या
// एकंदर क्रमात previous_X::propertyId ऐवजी previous_X::propertyId::yearId
// अशा क्रमवार उप-नोंदी) - त्यामुळे त्याच totalPaid वर चालवल्यास त्या
// मालमत्तेपुरता/घटकापुरता एकूण paid/balance पहिल्यासारखाच राहतो, फक्त तो
// नेमक्या कोणत्या वर्षात मोजला गेला हे अतिरिक्त कळते.
// yearRows: getDueBreakdownForCode च्या यादीसारख्याच स्वरूपाचे, पण प्रत्येक
// मालमत्तेच्या प्रत्येक (निवडलेल्या वर्षापर्यंतच्या) वर्षाची स्वतंत्र नोंद.
function buildYearWiseDetail(portions, yearRows, baseOrder, selectedYear) {
  const dues = {};
  const order = [];
  const meta = {};
  for (const componentKey of baseOrder) {
    const isPrevious = componentKey.startsWith('previous_');
    const component = componentKey.slice(componentKey.indexOf('_') + 1);
    for (const portion of portions) {
      if (isPrevious) {
        const yearsForPortion = yearRows
          .filter((r) => r.property_id === portion.property_id && r.year_label < selectedYear.year_label)
          .slice()
          .sort((a, b) => (a.year_label < b.year_label ? -1 : a.year_label > b.year_label ? 1 : 0));
        for (const yr of yearsForPortion) {
          const key = `${componentKey}::${portion.property_id}::${yr.financial_year_id}`;
          dues[key] = yr[component];
          order.push(key);
          meta[key] = {
            component, property_id: portion.property_id, malmata_no: portion.malmata_no,
            financial_year_id: yr.financial_year_id, year_label: yr.year_label, is_current: false,
          };
        }
      } else {
        const key = `${componentKey}::${portion.property_id}`;
        dues[key] = portion[componentKey];
        order.push(key);
        meta[key] = {
          component, property_id: portion.property_id, malmata_no: portion.malmata_no,
          financial_year_id: selectedYear.id, year_label: selectedYear.year_label, is_current: true,
        };
      }
    }
  }
  return { dues, order, meta };
}

// वरील exploded allocation चालवून, सपाट (flat) यादी परत देतो - प्रत्येक
// (घटक, मालमत्ता, वर्ष) साठी देय/जमा/बाकी - due-detail राऊटसाठी.
function getDetailedAllocationRows(portions, yearRows, baseOrder, selectedYear, totalPaid) {
  const { dues, order, meta } = buildYearWiseDetail(portions, yearRows, baseOrder, selectedYear);
  const alloc = allocate(dues, totalPaid, order);
  return order
    .map((key) => ({
      ...meta[key],
      due: round2(dues[key]),
      paid: round2(alloc.paid[key]),
      balance: round2(alloc.balance[key]),
    }))
    .filter((r) => r.due !== 0 || r.paid !== 0);
}

module.exports = {
  ALLOCATION_ORDER, GHARPATTI_GROUP_ORDER, PANIPATTI_GROUP_ORDER, GROUP_ORDER_BY_TYPE,
  allocate, sumDue, sumAllocation, round2, explodeDuesByPortion, collapseByComponent,
  getDetailedAllocationRows,
};
