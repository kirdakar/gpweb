// नमुना ४ - पंचायतीचे भत्ते व दायित्वे. कागदी नमुन्यावरील प्रत्येक ओळ
// स्थिर आहे (कायद्याने ठरलेली); फक्त रक्कम दरवर्षी बदलते - म्हणून इथे
// ledger_heads सारखा वृक्ष नाही, फक्त एक निश्चित यादी (ITEMS) आणि
// वर्षनिहाय रकमा (assets_liabilities टेबल).
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

// A6/A7/A8 आता fixed_assets (नमुना २२/२३/२४) वरून आपोआप काढले जातात - हाताने
// टाईप करायचे नाहीत (डुप्लिकेट नोंद टाळण्यासाठी, फेज ३अ).
const DERIVED_ASSET_CODES = { A6: 'स्थावर', A7: 'रस्ते', A8: 'जमीन' };

const ITEMS = {
  'दायित्वे': [
    { code: 'L1a', name: 'थकीत देयके (क) वेतन' },
    { code: 'L1b', name: 'थकीत देयके (ख) वेतनाव्यतिरिक्त इतर आस्थापना' },
    { code: 'L1c', name: 'थकीत देयके (ग) साधनसामग्री' },
    { code: 'L1d', name: 'थकीत देयके (घ) बांधकाम' },
    { code: 'L1e', name: 'थकीत देयके (ङ) इतर' },
    { code: 'L2', name: 'कर्ज, हप्ता व कर्जावरील व्याज हप्ता' },
    { code: 'L3', name: 'इतर देय रकमा' },
    { code: 'L4', name: 'ठेवी परतावा बाकी' },
    { code: 'L5', name: 'समाजकल्याण अनुशेष' },
    { code: 'L6', name: 'महिला व बालकल्याण अनुशेष' },
    { code: 'L7', name: 'इतर अनुशेष' },
  ],
  'भत्ता': [
    { code: 'A1', name: 'कर (येणे बाकी)' },
    { code: 'A2', name: 'करेतर (येणे बाकी)' },
    { code: 'A3a', name: 'शासनाकडून (क) नुकसानभरपाई अनुदान' },
    { code: 'A3b', name: 'शासनाकडून (ख) सहायक अनुदान' },
    { code: 'A4', name: 'इतर जमा रकमा' },
    { code: 'A5', name: 'अग्रिम वसुली बाकी' },
    { code: 'A6', name: 'पंचायतीची स्थावर मालमत्ता' },
    { code: 'A7', name: 'रस्ता मालमत्ता' },
    { code: 'A8', name: 'जमिनीची मालमत्ता' },
    { code: 'A9', name: 'पाणीपुरवठा योजना मालमत्ता' },
  ],
};

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  if (!financialYearId) return res.status(400).json({ error: 'financialYearId is required' });

  const [rows] = await pool.query(
    'SELECT side, item_code, amount FROM assets_liabilities WHERE financial_year_id = ?',
    [financialYearId]
  );
  const amountByCode = {};
  for (const r of rows) amountByCode[r.item_code] = Number(r.amount);

  const [assetRows] = await pool.query(
    'SELECT category, COALESCE(SUM(cost_amount), 0) AS total FROM fixed_assets GROUP BY category'
  );
  const assetTotalByCategory = Object.fromEntries(assetRows.map((r) => [r.category, Number(r.total)]));
  for (const [code, category] of Object.entries(DERIVED_ASSET_CODES)) {
    amountByCode[code] = assetTotalByCategory[category] ?? 0;
  }

  const result = {};
  for (const side of Object.keys(ITEMS)) {
    result[side] = ITEMS[side].map((item) => ({
      ...item,
      amount: amountByCode[item.code] ?? 0,
      derived: Boolean(DERIVED_ASSET_CODES[item.code]),
    }));
  }
  res.json(result);
});

router.put('/', requirePermission('assets_liabilities', 'edit'), async (req, res) => {
  const { financial_year_id, entries } = req.body || {};
  if (!financial_year_id || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'financial_year_id व entries (यादी) आवश्यक आहेत' });
  }
  const validCodes = new Set([...ITEMS['दायित्वे'], ...ITEMS['भत्ता']].map((i) => i.code));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      if (!validCodes.has(e.item_code)) continue;
      if (DERIVED_ASSET_CODES[e.item_code]) continue; // A6/A7/A8 आता fixed_assets वरून आपोआप - हाताने बदलता येत नाहीत
      const side = ITEMS['दायित्वे'].some((i) => i.code === e.item_code) ? 'दायित्वे' : 'भत्ता';
      const itemName = [...ITEMS['दायित्वे'], ...ITEMS['भत्ता']].find((i) => i.code === e.item_code).name;
      await conn.query(
        `INSERT INTO assets_liabilities (financial_year_id, side, item_code, item_name, amount)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [financial_year_id, side, e.item_code, itemName, Number(e.amount) || 0]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
