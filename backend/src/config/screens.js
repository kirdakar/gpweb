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
  { code: 'years', label: 'आर्थिक वर्ष', actions: ['view', 'add'] },
  { code: 'payments', label: 'कर जमा भरणे', actions: ['view', 'add', 'delete', 'print'] },
  { code: 'reports_property_list', label: 'मिळकत यादी अहवाल', actions: ['view', 'print'] },
  { code: 'reports_old_new', label: 'येणे बाकी अहवाल', actions: ['view', 'print'] },
  { code: 'reports_summary', label: 'सारांश अहवाल', actions: ['view', 'print'] },
  { code: 'reports_tax_demand', label: 'कर आकारणी अहवाल', actions: ['view', 'print'] },
  { code: 'reports_payment_receipts', label: 'जमा पावती अहवाल', actions: ['view', 'print'] },
  { code: 'reports_assessment_register', label: 'आकारणी यादी (नमुना ८)', actions: ['view', 'print'] },
  { code: 'reports_tax_demand_bill', label: 'कर मागणी बिल (नमुना ९ क)', actions: ['view', 'print'] },
  { code: 'settings', label: 'सेटिंग्ज', actions: ['view', 'edit'] },
];

const ACTION_LABELS = { view: 'पहा', add: 'नवीन', edit: 'संपादन', delete: 'मिटवा', print: 'प्रिंट' };

module.exports = { SCREENS, ACTION_LABELS };
