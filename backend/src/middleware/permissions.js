const pool = require('../config/db');

// यूजर मास्टर/अधिकार स्क्रीन फक्त प्रशासकालाच (role='admin') वापरता येते -
// जुन्या पद्धतीप्रमाणे एकच admin login गृहीत धरून, बाकीचे रोल्स
// (role='user') अधिकार-नियंत्रित असतात.
function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'फक्त प्रशासकाला (admin) ही सुविधा वापरता येईल' });
}

// admin ला नेहमी सर्व अधिकार (bypass). बाकीच्यांसाठी user_permissions मध्ये
// स्पष्ट allowed=1 नोंद असेल तरच पुढे जाऊ देतो - नोंद नसणे म्हणजे नकार
// (डीफॉल्ट-नकार, नवीन वापरकर्त्याला प्रशासकाने अधिकार दिल्याशिवाय काहीच करता येत नाही).
function requirePermission(screenCode, actionCode) {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    const [[row]] = await pool.query(
      'SELECT allowed FROM user_permissions WHERE user_id = ? AND screen_code = ? AND action_code = ?',
      [req.user.id, screenCode, actionCode]
    );
    if (row && row.allowed) return next();
    return res.status(403).json({ error: 'या कृतीसाठी आपल्याला अधिकार नाहीत' });
  };
}

module.exports = { requireAdmin, requirePermission };
