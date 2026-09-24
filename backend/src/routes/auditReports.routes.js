// नमुना ३० (लेखापरीक्षण आक्षेप पूर्तता नोंदवही) व नमुना २७ (मासिक विवरण).
// audit_reports = प्रत्येक अहवालाची एक ओळ; audit_compliance_logs = पूर्ततेच्या
// प्रत्येक प्रगतीची तारीखवार नोंद. नमुना ३० चे एकूण पूर्तता/मंजूर आकडे व
// नमुना २७ चे मासिक आकडे दोन्ही याच logs वरून काढले जातात - वेगळी नोंद नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const n = (v) => Number(v) || 0;

router.get('/', async (req, res) => {
  const [reports] = await pool.query('SELECT * FROM audit_reports ORDER BY report_year DESC, id DESC');
  const [sums] = await pool.query(
    `SELECT audit_report_id, SUM(complied_count) AS complied, SUM(ps_accepted_count) AS ps_accepted,
            SUM(auditor_accepted_count) AS auditor_accepted
     FROM audit_compliance_logs GROUP BY audit_report_id`
  );
  const byReport = new Map(sums.map((s) => [s.audit_report_id, s]));
  res.json(reports.map((r) => {
    const s = byReport.get(r.id) || {};
    const toComply = r.total_objections - r.info_only_count;
    const auditorAccepted = n(s.auditor_accepted);
    return {
      ...r,
      to_comply_count: toComply,
      complied_total: n(s.complied),
      ps_accepted_total: n(s.ps_accepted),
      auditor_accepted_total: auditorAccepted,
      pending_count: Math.max(toComply - auditorAccepted, 0),
      rem_total: n(r.rem_book_adjustment) + n(r.rem_recovery) + n(r.rem_valuation) + n(r.rem_irregular),
    };
  }));
});

// नमुना २७ - निवडलेल्या महिन्यातील पूर्ततेचे विवरण.
router.get('/monthly', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year आणि month आवश्यक आहेत' });
  const y = Number(year);
  const m = Number(month);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const next = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  const [reports] = await pool.query('SELECT * FROM audit_reports ORDER BY report_year, id');
  const [logs] = await pool.query(
    `SELECT *, DATE_FORMAT(log_date, '%Y-%m-%d') AS d FROM audit_compliance_logs WHERE log_date < ? ORDER BY log_date, id`,
    [next]
  );

  res.json(reports.map((r) => {
    const mine = logs.filter((l) => l.audit_report_id === r.id);
    const inMonth = mine.filter((l) => l.d >= first);
    const auditorTotal = mine.reduce((s, l) => s + l.auditor_accepted_count, 0);
    const lastReason = [...mine].reverse().find((l) => l.pending_reason)?.pending_reason || null;
    return {
      id: r.id,
      report_year: r.report_year,
      total_objections: r.total_objections,
      complied_in_month: inMonth.reduce((s, l) => s + l.complied_count, 0),
      ps_accepted_in_month: inMonth.reduce((s, l) => s + l.ps_accepted_count, 0),
      auditor_accepted_in_month: inMonth.reduce((s, l) => s + l.auditor_accepted_count, 0),
      pending_count: Math.max(r.total_objections - r.info_only_count - auditorTotal, 0),
      pending_reason: lastReason,
      remark: r.remark,
    };
  }));
});

router.get('/:id/logs', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM audit_compliance_logs WHERE audit_report_id = ? ORDER BY log_date, id', [req.params.id]);
  res.json(rows);
});

function readReport(body) {
  const { report_year, received_date, total_objections, info_only_count, objection_numbers, outward_no, ps_resolution_info,
    rem_book_adjustment, rem_recovery, rem_valuation, rem_irregular, remark } = body || {};
  return {
    report_year: (report_year || '').trim(), received_date: received_date || null,
    total_objections: n(total_objections), info_only_count: n(info_only_count),
    objection_numbers: objection_numbers || null, outward_no: outward_no || null, ps_resolution_info: ps_resolution_info || null,
    rem_book_adjustment: n(rem_book_adjustment), rem_recovery: n(rem_recovery), rem_valuation: n(rem_valuation),
    rem_irregular: n(rem_irregular), remark: remark || null,
  };
}

router.post('/', requirePermission('audit_reports', 'add'), async (req, res) => {
  const r = readReport(req.body);
  if (!r.report_year) return res.status(400).json({ error: 'लेखापरीक्षण अहवालाचे वर्ष आवश्यक आहे' });
  if (r.info_only_count > r.total_objections) return res.status(400).json({ error: 'केवळ माहितीसाठीचे आक्षेप एकूणपेक्षा जास्त असू शकत नाहीत' });
  const [result] = await pool.query(
    `INSERT INTO audit_reports (report_year, received_date, total_objections, info_only_count, objection_numbers, outward_no,
       ps_resolution_info, rem_book_adjustment, rem_recovery, rem_valuation, rem_irregular, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.report_year, r.received_date, r.total_objections, r.info_only_count, r.objection_numbers, r.outward_no,
      r.ps_resolution_info, r.rem_book_adjustment, r.rem_recovery, r.rem_valuation, r.rem_irregular, r.remark]
  );
  const [[row]] = await pool.query('SELECT * FROM audit_reports WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.put('/:id', requirePermission('audit_reports', 'edit'), async (req, res) => {
  const r = readReport(req.body);
  if (!r.report_year) return res.status(400).json({ error: 'लेखापरीक्षण अहवालाचे वर्ष आवश्यक आहे' });
  const [result] = await pool.query(
    `UPDATE audit_reports SET report_year=?, received_date=?, total_objections=?, info_only_count=?, objection_numbers=?,
       outward_no=?, ps_resolution_info=?, rem_book_adjustment=?, rem_recovery=?, rem_valuation=?, rem_irregular=?, remark=?
     WHERE id=?`,
    [r.report_year, r.received_date, r.total_objections, r.info_only_count, r.objection_numbers, r.outward_no,
      r.ps_resolution_info, r.rem_book_adjustment, r.rem_recovery, r.rem_valuation, r.rem_irregular, r.remark, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('audit_reports', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM audit_reports WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

router.post('/:id/logs', requirePermission('audit_reports', 'edit'), async (req, res) => {
  const { log_date, complied_count, ps_accepted_count, auditor_accepted_count, pending_reason, remark } = req.body || {};
  if (!log_date) return res.status(400).json({ error: 'दिनांक आवश्यक आहे' });
  const [[report]] = await pool.query('SELECT id FROM audit_reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'अहवाल सापडला नाही' });
  const [result] = await pool.query(
    `INSERT INTO audit_compliance_logs (audit_report_id, log_date, complied_count, ps_accepted_count, auditor_accepted_count, pending_reason, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, log_date, n(complied_count), n(ps_accepted_count), n(auditor_accepted_count), pending_reason || null, remark || null]
  );
  const [[row]] = await pool.query('SELECT * FROM audit_compliance_logs WHERE id = ?', [result.insertId]);
  res.status(201).json(row);
});

router.delete('/logs/:logId', requirePermission('audit_reports', 'delete'), async (req, res) => {
  const [result] = await pool.query('DELETE FROM audit_compliance_logs WHERE id = ?', [req.params.logId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'सापडले नाही' });
  res.json({ ok: true });
});

module.exports = router;
