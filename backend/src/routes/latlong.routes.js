// मिळकतीचे अक्षांश/रेखांश (latlong टेबल) - मालमत्ता क्रमांकानुसार ४ कोपऱ्यांचे बिंदू.
// गावाच्या नकाशासाठी सर्व मिळकती (GET /), मिळकत नोंद स्क्रीनसाठी एका मालमत्ता क्रमांकाचे
// बिंदू वाचणे/जतन करणे (GET/PUT /:malmataNo). अधिकार: 'मिळकत नोंदी' (properties) स्क्रीनचेच.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

// सर्व बिंदू मालमत्ता क्रमांकानुसार गटबद्ध + त्या क्रमांकाच्या मिळकतदाराची माहिती (नकाशाच्या पॉपअपसाठी).
router.get('/', async (req, res) => {
  const [pts] = await pool.query(
    'SELECT malmata_no, point_no, latitude, longitude FROM latlong ORDER BY malmata_no, point_no'
  );
  const [props] = await pool.query(
    `SELECT pm.id, pm.malmata_no, pm.property_code, pm.particulars, pt.par_name AS construction_type_name,
            COALESCE(gm.owner_name, pm.owner_name) AS owner_name,
            COALESCE(gm.spouse_name, pm.spouse_name) AS spouse_name
     FROM property_master pm
     LEFT JOIN gpmaster gm ON gm.code = pm.property_code
     LEFT JOIN particular_master pt ON pt.par_code = pm.construction_type
     WHERE pm.malmata_no IN (SELECT DISTINCT malmata_no FROM latlong)
     ORDER BY pm.property_code, pm.id`
  );
  const byNo = new Map();
  for (const p of pts) {
    if (!byNo.has(p.malmata_no)) byNo.set(p.malmata_no, { malmata_no: p.malmata_no, points: [], property: null, portions: [] });
    byNo.get(p.malmata_no).points.push({ point_no: p.point_no, latitude: Number(p.latitude), longitude: Number(p.longitude) });
  }
  for (const pr of props) {
    const g = byNo.get(pr.malmata_no);
    // त्या मालमत्ता क्रमांकाखालील सर्व भाग (बांधकाम प्रकार: घर/शेड/खुली जागा इ.) - नकाशाच्या पॉपअपसाठी
    if (g) g.portions.push({ construction_type_name: pr.construction_type_name, particulars: pr.particulars });
    if (g && !g.property) g.property = { id: pr.id, property_code: pr.property_code, owner_name: pr.owner_name, spouse_name: pr.spouse_name };
  }
  res.json([...byNo.values()]);
});

router.get('/:malmataNo', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT point_no, latitude, longitude FROM latlong WHERE malmata_no = ? ORDER BY point_no', [req.params.malmataNo]
  );
  res.json(rows.map((r) => ({ point_no: r.point_no, latitude: Number(r.latitude), longitude: Number(r.longitude) })));
});

// अंश-दिशा स्वरूप ("17.91068081N"/"74.98181051E") किंवा साधा दशांश आकडा - दोन्ही स्वीकारतो.
function parseCoord(v) {
  const m = String(v ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*([NSEWnsew]?)$/);
  if (!m) return null;
  let n = Number(m[1]);
  if (/[SWsw]/.test(m[2])) n = -Math.abs(n);
  return Number.isFinite(n) ? n : null;
}

// body: { points: [{latitude, longitude}, ...] } - पूर्ण यादी बदलते (रिकामी यादी = सर्व बिंदू काढणे).
// पूर्ण रिकाम्या ओळी वगळतो; अर्धवट (फक्त एकच) भरलेली ओळ असल्यास नकार.
router.put('/:malmataNo', requirePermission('properties', 'edit'), async (req, res) => {
  const malmataNo = String(req.params.malmataNo).trim();
  if (!malmataNo) return res.status(400).json({ error: 'मालमत्ता क्रमांक आवश्यक आहे' });
  const input = Array.isArray(req.body?.points) ? req.body.points : [];
  const clean = [];
  for (const [i, p] of input.entries()) {
    const lat = String(p.latitude ?? '').trim();
    const lng = String(p.longitude ?? '').trim();
    if (!lat && !lng) continue;
    const la = parseCoord(lat);
    const lo = parseCoord(lng);
    if (la === null || lo === null) return res.status(400).json({ error: `बिंदू ${i + 1}: अक्षांश व रेखांश दोन्ही आकड्यात भरा` });
    if (Math.abs(la) > 90 || Math.abs(lo) > 180) return res.status(400).json({ error: `बिंदू ${i + 1}: अक्षांश/रेखांश मर्यादेबाहेर आहे` });
    clean.push([la, lo]);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM latlong WHERE malmata_no = ?', [malmataNo]);
    for (const [i, [la, lo]] of clean.entries()) {
      await conn.query('INSERT INTO latlong (malmata_no, point_no, latitude, longitude) VALUES (?, ?, ?, ?)', [malmataNo, i + 1, la, lo]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  res.json({ ok: true, count: clean.length });
});

module.exports = router;
