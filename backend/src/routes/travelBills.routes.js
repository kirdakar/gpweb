// नमुना ३१ - प्रवास भत्ता देयक. भाडे + मैल भत्ता + दैनिक भत्ता यांची बेरीज
// (सर्व्हरवर गणित करून) नोंद करताच cash_book_entries मध्ये एकच खर्च नोंद
// तयार होते - रक्कम दुसऱ्यांदा नमुना ५ मध्ये टाईप करायची नाही (फेज ३क च्या
// नमुना १७/२५/२९ प्रमाणेच "तयार करा = लगेच पोस्ट करा" पद्धत).
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { round2 } = require('../utils/dueAllocation');

const router = express.Router();
router.use(requireAuth);

// नमुना ३१ च्या कागदी रकान्यांचे वर्णनात्मक फील्ड (कार्यालयाचे ठिकाण, निर्गमन वेळ, आगमन तारीख/वेळ, प्रवासाचे साधन, वर्ग, तिकिटे,
// रेल्वे/बोटीचे नाव, प्रमाणके, शेरा) - रकमेवर परिणाम नाही; नोंद करताना किंवा नंतर "तपशील पूर्ण करा" ने भरता/बदलता येतात.
const EXTRA_TEXT = ['office_place', 'depart_time', 'arrival_time', 'transport_mode', 'travel_class', 'vehicle_name', 'enclosures', 'remark'];
async function saveExtras(id, body) {
  const sets = [];
  const params = [];
  for (const f of EXTRA_TEXT) {
    if (body[f] !== undefined) { sets.push(`${f} = ?`); params.push(body[f] ? String(body[f]).trim() || null : null); }
  }
  if (body.arrival_date !== undefined) { sets.push('arrival_date = ?'); params.push(body.arrival_date || null); }
  if (body.ticket_count !== undefined) {
    const tc = body.ticket_count === '' || body.ticket_count == null ? null : Number(body.ticket_count);
    sets.push('ticket_count = ?'); params.push(tc !== null && tc >= 0 ? tc : null);
  }
  if (sets.length) await pool.query(`UPDATE travel_bills SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
}

function computeTotal(b) {
  const fare = Number(b.fare_amount || 0);
  const mileage = Number(b.mileage_km || 0) * Number(b.mileage_rate || 0);
  const daily = Number(b.daily_allowance_days || 0) * Number(b.daily_allowance_rate || 0);
  return { mileageAmount: round2(mileage), dailyAmount: round2(daily), total: round2(fare + mileage + daily) };
}

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  const where = [];
  const params = [];
  if (financialYearId) { where.push('t.financial_year_id = ?'); params.push(financialYearId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT t.*, lh.code AS head_code, lh.name AS head_name
     FROM travel_bills t JOIN ledger_heads lh ON lh.id = t.ledger_head_id
     ${whereSql} ORDER BY t.travel_date DESC, t.id DESC`,
    params
  );
  res.json(rows.map((r) => {
    const { mileageAmount, dailyAmount, total } = computeTotal(r);
    return { ...r, mileage_amount: mileageAmount, daily_allowance_amount: dailyAmount, total_amount: total };
  }));
});

router.post('/', requirePermission('travel_bills', 'add'), async (req, res) => {
  const {
    traveller_name, financial_year_id, travel_date, from_place, to_place, purpose,
    fare_amount, mileage_km, mileage_rate, daily_allowance_days, daily_allowance_rate,
    ledger_head_id, remark,
  } = req.body || {};
  if (!traveller_name || !traveller_name.trim()) return res.status(400).json({ error: 'नाव आवश्यक आहे' });
  if (!financial_year_id || !travel_date || !ledger_head_id) return res.status(400).json({ error: 'वर्ष, दिनांक व लेखाशीर्ष आवश्यक आहेत' });

  const [[head]] = await pool.query('SELECT id, group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== 'खर्च') return res.status(400).json({ error: 'खर्च गटातील लेखाशीर्ष निवडा' });

  const billFields = { fare_amount, mileage_km, mileage_rate, daily_allowance_days, daily_allowance_rate };
  const { total } = computeTotal(billFields);
  if (total <= 0) return res.status(400).json({ error: 'एकूण रक्कम शून्यापेक्षा जास्त हवी' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cashResult] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'खर्च', 'मुख्य', ?, 'रोख', ?, ?)`,
      [financial_year_id, travel_date, ledger_head_id, total, `प्रवास भत्ता देयक (नमुना ३१) - ${traveller_name.trim()}${purpose ? ' - ' + purpose : ''}`, req.user.id]
    );
    const [result] = await conn.query(
      `INSERT INTO travel_bills
         (traveller_name, financial_year_id, travel_date, from_place, to_place, purpose, fare_amount,
          mileage_km, mileage_rate, daily_allowance_days, daily_allowance_rate, ledger_head_id, cash_book_entry_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [traveller_name.trim(), financial_year_id, travel_date, from_place || null, to_place || null, purpose || null,
        Number(fare_amount) || 0, Number(mileage_km) || 0, Number(mileage_rate) || 0,
        Number(daily_allowance_days) || 0, Number(daily_allowance_rate) || 0, ledger_head_id, cashResult.insertId, remark || null]
    );
    await conn.commit();
    await saveExtras(result.insertId, req.body || {});
    const [[row]] = await pool.query(
      `SELECT t.*, lh.code AS head_code, lh.name AS head_name FROM travel_bills t
       JOIN ledger_heads lh ON lh.id = t.ledger_head_id WHERE t.id = ?`,
      [result.insertId]
    );
    const { mileageAmount, dailyAmount, total: totalAmt } = computeTotal(row);
    res.status(201).json({ ...row, mileage_amount: mileageAmount, daily_allowance_amount: dailyAmount, total_amount: totalAmt });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

router.put('/:id/details', requirePermission('travel_bills', 'edit'), async (req, res) => {
  const [[bill]] = await pool.query('SELECT id FROM travel_bills WHERE id = ?', [req.params.id]);
  if (!bill) return res.status(404).json({ error: 'देयक सापडले नाही' });
  await saveExtras(req.params.id, req.body || {});
  res.json({ ok: true });
});

module.exports = router;
