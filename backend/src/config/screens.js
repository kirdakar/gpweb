// स्क्रीन/फॉर्म व त्यावरील बटणांची (actions) व्याख्या - "यूजर अधिकार" स्क्रीनसाठी
// अधिकार-मॅट्रिक्स तयार करण्यासाठी आणि सर्व्हरवरील परवानगी तपासणीसाठी एकच जागा
// (frontend हीच यादी GET /api/users/screens वरून आणतो, वेगळी कॉपी ठेवत नाही).
//
// 'view' आणि 'print' या actions फक्त frontend कडून वापरल्या जातात (मेनू/बटण
// दाखवायचे की लपवायचे) - कारण अनेक रिपोर्ट स्क्रीन एकमेकांचा /properties सारखा
// समान DATA endpoint वापरतात, त्यामुळे तो एका screen च्या नावाने सर्व्हरवर बंद
// करणे इतर स्क्रीनना मोडेल. 'add'/'edit'/'delete' मात्र प्रत्यक्ष बदल करणाऱ्या
// (mutating) राऊटवर सर्व्हरवरही तपासल्या जातात (पहा middleware/permissions.js).
const SCREENS = [
  { code: 'dashboard', label: 'डॅशबोर्ड', actions: ['view'] },
  { code: 'properties', label: 'मिळकत नोंदी', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'particulars', label: 'दर मास्टर', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'gpmaster', label: 'मिळकतदार मास्टर (GPMASTER)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'years', label: 'आर्थिक वर्ष', actions: ['view', 'add', 'delete'] },
  { code: 'payments', label: 'कर जमा भरणे', actions: ['view', 'add', 'delete', 'print'] },
  { code: 'reports_property_list', label: 'मिळकत यादी अहवाल', actions: ['view', 'print'] },
  { code: 'reports_old_new', label: 'येणे बाकी अहवाल', actions: ['view', 'print'] },
  { code: 'reports_summary', label: 'सारांश अहवाल', actions: ['view', 'print'] },
  { code: 'reports_tax_demand', label: 'कर आकारणी अहवाल', actions: ['view', 'print'] },
  { code: 'reports_payment_receipts', label: 'जमा पावती अहवाल', actions: ['view', 'print'] },
  { code: 'reports_assessment_register', label: 'आकारणी यादी (नमुना ८)', actions: ['view', 'print'] },
  { code: 'reports_tax_demand_bill', label: 'कर मागणी बिल (नमुना ९ क)', actions: ['view', 'print'] },
  { code: 'settings', label: 'सेटिंग्ज', actions: ['view', 'edit'] },
  // ग्रामपंचायत लेखा संहिता, २०११ - नमुना १ ते ३३ (फेज १: लेजर पाया)
  { code: 'ledger_heads', label: 'लेखाशीर्ष मास्टर', actions: ['view', 'edit'] },
  { code: 'cash_book', label: 'दैनिक रोकड वही (नमुना ५)', actions: ['view', 'add', 'delete', 'print'] },
  { code: 'reports_cash_book', label: 'रोकड वही अहवाल (नमुना ५)', actions: ['view', 'print'] },
  { code: 'reports_ledger_classified', label: 'वर्गीकृत नोंदवही (नमुना ६)', actions: ['view', 'print'] },
  { code: 'assets_liabilities', label: 'भत्ते व दायित्वे नोंदणी (नमुना ४)', actions: ['view', 'add', 'edit'] },
  { code: 'reports_assets_liabilities', label: 'भत्ते व दायित्वे अहवाल (नमुना ४)', actions: ['view', 'print'] },
  // फेज २: अंदाजपत्रक व मासिक अहवाल (नमुना १, २, ३, २६-क, २८)
  { code: 'budget_entries', label: 'वार्षिक अंदाजपत्रक नोंदणी (नमुना १)', actions: ['view', 'edit'] },
  { code: 'reports_budget', label: 'वार्षिक अंदाजपत्रक अहवाल (नमुना १)', actions: ['view', 'print'] },
  { code: 'budget_revisions', label: 'पुनर्विनियोजन नोंदणी (नमुना २)', actions: ['view', 'edit'] },
  { code: 'reports_budget_revision', label: 'पुनर्विनियोजन अहवाल (नमुना २)', actions: ['view', 'print'] },
  { code: 'reports_annual_summary', label: 'वार्षिक जमा-खर्च (नमुना ३)', actions: ['view', 'print'] },
  { code: 'reports_monthly_statement', label: 'मासिक जमा-खर्च विवरण (नमुना २६-क)', actions: ['view', 'print'] },
  { code: 'reports_welfare_expenditure', label: 'मागासवर्गीय/महिला-बाल मासिक विवरण (नमुना २८)', actions: ['view', 'print'] },
  // फेज ३अ: किरकोळ रोकडवही (नमुना १८), पावती/प्रमाणक (नमुना ७/१२), मालमत्ता नोंदवह्या (नमुना १६/२२/२३/२४)
  { code: 'reports_receipt_voucher', label: 'पावती/प्रमाणक/परतावा आदेश प्रिंट (नमुना ७/१२/३२)', actions: ['view', 'print'] },
  { code: 'fixed_assets', label: 'मालमत्ता नोंदणी (नमुना १६/२२/२३/२४)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'reports_fixed_assets', label: 'मालमत्ता अहवाल (नमुना १६/२२/२३/२४)', actions: ['view', 'print'] },
  // फेज ३ब: कर्मचारी सूची (नमुना १३) व मासिक वेतन देयक (नमुना २१)
  { code: 'staff_master', label: 'कर्मचारी सूची व वेतनश्रेणी (नमुना १३)', actions: ['view', 'add', 'edit', 'delete', 'print'] },
  { code: 'staff_salary_bills', label: 'मासिक वेतन देयक नोंदणी (नमुना २१)', actions: ['view', 'edit'] },
  { code: 'reports_staff_salary_bills', label: 'मासिक वेतन देयक अहवाल (नमुना २१)', actions: ['view', 'print'] },
  // फेज ३क: अग्रिम/अनामत (नमुना १७), गुंतवणूक (नमुना २५), कर्ज (नमुना २९)
  { code: 'advance_deposits', label: 'अग्रिम/अनामत नोंदणी (नमुना १७)', actions: ['view', 'add', 'edit'] },
  { code: 'reports_advance_deposits', label: 'अग्रिम/अनामत अहवाल (नमुना १७)', actions: ['view', 'print'] },
  { code: 'investments', label: 'गुंतवणूक नोंदणी (नमुना २५)', actions: ['view', 'add', 'edit'] },
  { code: 'reports_investments', label: 'गुंतवणूक अहवाल (नमुना २५)', actions: ['view', 'print'] },
  { code: 'loans', label: 'कर्ज नोंदणी (नमुना २९)', actions: ['view', 'add', 'edit'] },
  { code: 'reports_loans', label: 'कर्ज अहवाल (नमुना २९)', actions: ['view', 'print'] },
  // फेज ३ड: प्रवास भत्ता देयक (नमुना ३१); परतावा आदेश (नमुना ३२) वेगळी स्क्रीन नाही - reports_receipt_voucher वापरते
  { code: 'travel_bills', label: 'प्रवास भत्ता देयक नोंदणी (नमुना ३१)', actions: ['view', 'add', 'edit'] },
  { code: 'reports_travel_bills', label: 'प्रवास भत्ता देयक अहवाल (नमुना ३१)', actions: ['view', 'print'] },
  // फेज ३इ: लेखापरीक्षण आक्षेप (नमुना ३०, २७) व मासिक शिल्लक विवरण (नमुना २६-ख)
  { code: 'audit_reports', label: 'लेखापरीक्षण आक्षेप नोंदणी (नमुना ३०)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'reports_audit_register', label: 'लेखापरीक्षण आक्षेप पूर्तता नोंदवही (नमुना ३०)', actions: ['view', 'print'] },
  { code: 'reports_audit_monthly', label: 'आक्षेप पूर्ततेचे मासिक विवरण (नमुना २७)', actions: ['view', 'print'] },
  { code: 'balance_statements', label: 'मासिक शिल्लक विवरण नोंदणी (नमुना २६-ख)', actions: ['view', 'edit'] },
  { code: 'reports_balance_statements', label: 'मासिक शिल्लक विवरण अहवाल (नमुना २६-ख)', actions: ['view', 'print'] },
  // फेज ३फ: सार्वजनिक बांधकाम (नमुना २०, २०क, २०ख) व हजेरीपट (नमुना १९)
  { code: 'contractors', label: 'कंत्राटदार मास्टर', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'rate_schedule', label: 'दरसूची मास्टर', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'works', label: 'बांधकाम नोंदणी (नमुना २०/२०क/२०ख)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'muster_rolls', label: 'हजेरीपट नोंदणी (नमुना १९)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'reports_muster_roll', label: 'हजेरीपट अहवाल (नमुना १९)', actions: ['view', 'print'] },
  { code: 'reports_work_estimate', label: 'कामाच्या अंदाजाची नोंदवही (नमुना २०)', actions: ['view', 'print'] },
  { code: 'reports_work_measurement', label: 'मोजमाप वही (नमुना २०क)', actions: ['view', 'print'] },
  { code: 'reports_work_bills', label: 'कामाचे देयक (नमुना २०ख)', actions: ['view', 'print'] },
  // फेज ३ग: किरकोळ मागणी (नमुना ११), मुद्रांक हिशोब (१४), उपभोग्य वस्तू साठा (१५), वृक्ष नोंदवही (३३)
  { code: 'misc_demands', label: 'किरकोळ मागणी नोंदणी (नमुना ११)', actions: ['view', 'add', 'edit'] },
  { code: 'reports_misc_demands', label: 'किरकोळ मागणी अहवाल (नमुना ११)', actions: ['view', 'print'] },
  { code: 'stamps', label: 'मुद्रांक हिशोब नोंदणी (नमुना १४)', actions: ['view', 'add', 'delete'] },
  { code: 'reports_stamps', label: 'मुद्रांक हिशोब अहवाल (नमुना १४)', actions: ['view', 'print'] },
  { code: 'stock_items', label: 'उपभोग्य वस्तू मास्टर (नमुना १५)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'stock_register', label: 'उपभोग्य वस्तू साठा नोंदणी (नमुना १५)', actions: ['view', 'add', 'delete'] },
  { code: 'reports_stock', label: 'उपभोग्य वस्तू साठा अहवाल (नमुना १५)', actions: ['view', 'print'] },
  { code: 'trees', label: 'वृक्ष नोंदणी (नमुना ३३)', actions: ['view', 'add', 'edit', 'delete'] },
  { code: 'reports_trees', label: 'वृक्ष नोंदवही अहवाल (नमुना ३३)', actions: ['view', 'print'] },
];

const ACTION_LABELS = { view: 'पहा', add: 'नवीन', edit: 'संपादन', delete: 'मिटवा', print: 'प्रिंट' };

module.exports = { SCREENS, ACTION_LABELS };
