// घरपट्टी सूट (discount) / दंड (penalty) नियम - सर्वांना किंवा एका व्यक्तीस (कोड),
// टक्केवारीत किंवा रकमेत, मागील / चालू / दोन्ही बाकीवर. नियम आकारणी बदलत नाहीत; येणे बाकी
// काढताना लागतात (पहा utils/taxAdjustments.js) - म्हणून सर्व अहवाल व एंट्री फॉर्मवर परिणाम आपोआप.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { getDueBreakdownBulk } = require('../utils/dueBreakdown');
const { applyTaxAdjustments } = require('../utils/taxAdjustments');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

const KINDS = ['सूट', 'दंड'];
const APPLIES = ['मागील', 'चालू', 'दोन्ही'];
const MODES = ['टक्के', 'रक्कम'];
const SCOPES = ['सर्व', 'एक'];

function readRule(b) {
  const flag = (v) => (v === true || v === 1 || v === '1' ? 1 : 0);
  return {
    financial_year_id: Number(b.financial_year_id),
    scope: b.scope, property_code: b.scope === 'एक' ? Number(b.property_code) : null,
    kind: b.kind, applies_to: b.applies_to,
    on_gharpatti: flag(b.on_gharpatti), on_divabatti: flag(b.on_divabatti), on_arogya: flag(b.on_arogya), on_panipatti: flag(b.on_panipatti),
    mode: b.mode, value: Number(b.value),
    reason: b.reason || null, order_no: b.order_no || null, order_date: b.order_date || null,
  };
}

function validate(r) {
  if (!r.financial_year_id) return 'वर्ष आवश्यक आहे';
  if (!SCOPES.includes(r.scope)) return 'सर्वांना की एका व्यक्तीस ते निवडा';
  if (r.scope === 'एक' && !(r.property_code > 0)) return 'व्यक्तीचा कोड आवश्यक आहे';
  if (!KINDS.includes(r.kind)) return 'सूट की दंड ते निवडा';
  if (!APPLIES.includes(r.applies_to)) return 'मागील / चालू / दोन्ही निवडा';
  if (!MODES.includes(r.mode)) return 'टक्के की रक्कम ते निवडा';
  if (!(r.value > 0)) return 'मूल्य शून्यापेक्षा जास्त हवे';
  if (r.mode === 'टक्के' && r.value > 100 && r.kind === 'सूट') return 'सूट 100% पेक्षा जास्त असू शकत नाही';
  if (!(r.on_gharpatti || r.on_divabatti || r.on_arogya || r.on_panipatti)) return 'किमान एक कर घटक निवडा';
  return null;
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  const [rows] = await pool.query(
    `SELECT t.id, t.financial_year_id, t.scope, t.property_code, t.kind, t.applies_to,
            t.on_gharpatti, t.on_divabatti, t.on_arogya, t.on_panipatti, t.mode, t.value,
            t.reason, t.order_no, DATE_FORMAT(t.order_date, '%Y-%m-%d') AS order_date, t.is_active, t.created_at,
            (SELECT pm.owner_name FROM property_master pm WHERE pm.property_code = t.property_code
               AND pm.owner_name IS NOT NULL AND pm.owner_name <> '' ORDER BY pm.id LIMIT 1) AS owner_name
     FROM tax_adjustments t ${financialYearId ? 'WHERE t.financial_year_id = ?' : ''} ORDER BY t.id DESC`,
    financialYearId ? [financialYearId] : []
  );
  res.json(rows);
});

// नियम जतन करण्याआधी परिणाम पाहण्यासाठी: किती व्यक्तींना, एकूण किती सूट/दंड (फक्त हाच नवा नियम, जुने नियम वगळून).
router.post('/preview', requirePermission('tax_adjustments', 'add'), async (req, res) => {
  const rule = readRule(req.body || {});
  const err = validate(rule);
  if (err) return res.status(400).json({ error: err });
  const { rows } = await getDueBreakdownBulk(pool, rule.financial_year_id, { skipAdjustments: true });
  const adjusted = applyTaxAdjustments(rows, [rule]);
  const persons = new Set();
  let total = 0;
  for (const r of adjusted) {
    const amt = rule.kind === 'सूट' ? r.discount_total : r.penalty_total;
    if (amt > 0) { persons.add(r.property_code ?? `p${r.property_id}`); total += amt; }
  }
  res.json({ persons: persons.size, total: round2(total) });
});

router.post('/', requirePermission('tax_adjustments', 'add'), async (req, res) => {
  const r = readRule(req.body || {});
  const err = validate(r);
  if (err) return res.status(400).json({ error: err });
  if (r.scope === 'एक') {
    const [[pm]] = await pool.query('SELECT id FROM property_master WHERE property_code = ? LIMIT 1', [r.property_code]);
    if (!pm) return res.status(404).json({ error: 'हा कोड सापडला नाही' });
  }
  const [result] = await pool.query(
    `INSERT INTO tax_adjustments
       (financial_year_id, scope, property_code, kind, applies_to, on_gharpatti, on_divabatti, on_arogya, on_panipatti,
        mode, value, reason, order_no, order_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.financial_year_id, r.scope, r.property_code, r.kind, r.applies_to, r.on_gharpatti, r.on_divabatti, r.on_arogya, r.on_panipatti,
      r.mode, r.value, r.reason, r.order_no, r.order_date, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});

router.patch('/:id/active', requirePermission('tax_adjustments', 'edit'), async (req, res) => {
  const active = req.body && (req.body.is_active === true || req.body.is_active === 1) ? 1 : 0;
  const [r] = await pool.query('UPDATE tax_adjustments SET is_active = ? WHERE id = ?', [active, req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true, is_active: active });
});

router.delete('/:id', requirePermission('tax_adjustments', 'delete'), async (req, res) => {
  const [r] = await pool.query('DELETE FROM tax_adjustments WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
