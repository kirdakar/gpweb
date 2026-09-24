import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const emptyForm = {
  report_year: '', received_date: '', total_objections: '', info_only_count: '', objection_numbers: '',
  outward_no: '', ps_resolution_info: '', rem_book_adjustment: '', rem_recovery: '', rem_valuation: '', rem_irregular: '', remark: '',
};
const emptyLog = { log_date: '', complied_count: '', ps_accepted_count: '', auditor_accepted_count: '', pending_reason: '', remark: '' };

// नमुना ३० - लेखापरीक्षण आक्षेप नोंदणी. प्रत्येक अहवालाची एक ओळ, आणि पूर्ततेच्या
// प्रत्येक प्रगतीची तारीखवार नोंद (logs). नमुना ३० चे एकूण पूर्तता/मंजूर आकडे
// आणि नमुना २७ (मासिक विवरण) दोन्ही याच logs वरून आपोआप काढले जातात - दोन्ही
// फॉर्मसाठी वेगळी नोंद करायची नाही.
export default function AuditReportEntry() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openLogsId, setOpenLogsId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logForm, setLogForm] = useState(emptyLog);

  function load() {
    setLoading(true);
    client.get('/audit-reports').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function startEdit(r) {
    setEditingId(r.id);
    const f = {};
    for (const k of Object.keys(emptyForm)) f[k] = r[k] == null ? '' : String(r[k]);
    f.received_date = r.received_date ? r.received_date.slice(0, 10) : '';
    setForm(f);
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.report_year.trim()) { setError('लेखापरीक्षण अहवालाचे वर्ष आवश्यक आहे'); return; }
    setBusy(true);
    try {
      if (editingId) await client.put(`/audit-reports/${editingId}`, form);
      else await client.post('/audit-reports', form);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('हा अहवाल व त्याच्या सर्व पूर्तता नोंदी मिटवायच्या आहेत का?')) return;
    await client.delete(`/audit-reports/${id}`);
    load();
  }

  async function toggleLogs(id) {
    if (openLogsId === id) { setOpenLogsId(null); return; }
    setOpenLogsId(id);
    setLogForm({ ...emptyLog, log_date: new Date().toISOString().slice(0, 10) });
    const { data } = await client.get(`/audit-reports/${id}/logs`);
    setLogs(data);
  }

  async function addLog(id) {
    setError('');
    try {
      await client.post(`/audit-reports/${id}/logs`, logForm);
      const { data } = await client.get(`/audit-reports/${id}/logs`);
      setLogs(data);
      setLogForm({ ...emptyLog, log_date: new Date().toISOString().slice(0, 10) });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली');
    }
  }

  async function deleteLog(logId, reportId) {
    if (!window.confirm('ही पूर्तता नोंद मिटवायची आहे का?')) return;
    await client.delete(`/audit-reports/logs/${logId}`);
    const { data } = await client.get(`/audit-reports/${reportId}/logs`);
    setLogs(data);
    load();
  }

  const canAdd = can('audit_reports', 'add');
  const canEdit = can('audit_reports', 'edit');
  const f = (k, label, type = 'text', extra = {}) => (
    <div className="field" {...extra}><label>{label}</label>
      <input type={type} min={type === 'number' ? 0 : undefined} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
  );

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>लेखापरीक्षण आक्षेप नोंदणी (नमुना ३०)</h1>
        <CloseReportButton />
      </div>

      {(canAdd || (editingId && canEdit)) && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {f('report_year', 'लेखापरीक्षण अहवालाचे वर्ष (उदा. 2023-2024)')}
              {f('received_date', 'अहवाल प्राप्त झाल्याचा दिनांक', 'date')}
              {f('total_objections', 'एकूण आक्षेप/परिच्छेद संख्या', 'number')}
              {f('info_only_count', 'केवळ माहितीसाठी असलेले आक्षेप', 'number')}
              {f('objection_numbers', 'आक्षेपांचे अनुक्रमांक')}
              {f('outward_no', 'पंचायत समितीकडे पाठविल्याचा जावक क्र. व दिनांक')}
              {f('ps_resolution_info', 'पंचायत समितीचा ठराव/जावक तपशील')}
              {f('rem_book_adjustment', 'शिल्लक: पुस्तकी समायोजन', 'number')}
              {f('rem_recovery', 'शिल्लक: वसुली', 'number')}
              {f('rem_valuation', 'शिल्लक: मूल्यांकन', 'number')}
              {f('rem_irregular', 'शिल्लक: नियमबाह्य', 'number')}
              {f('remark', 'शेरा', 'text', { style: { gridColumn: 'span 2' } })}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>वर्ष</th><th>प्राप्त</th><th className="num">एकूण</th><th className="num">पूर्तता आवश्यक</th><th className="num">पूर्तता केलेले</th><th className="num">मंजूर (लेखा परीक्षक)</th><th className="num">प्रलंबित</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>{r.report_year}</td>
                      <td>{r.received_date?.slice(0, 10) || '-'}</td>
                      <td className="num">{r.total_objections}</td>
                      <td className="num">{r.to_comply_count}</td>
                      <td className="num">{r.complied_total}</td>
                      <td className="num">{r.auditor_accepted_total}</td>
                      <td className="num">{r.pending_count}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn secondary small" onClick={() => toggleLogs(r.id)}>पूर्तता नोंदी</button>
                        {canEdit && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                        {can('audit_reports', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                      </td>
                    </tr>
                    {openLogsId === r.id && (
                      <tr>
                        <td colSpan={8}>
                          <div className="card" style={{ margin: '8px 0' }}>
                            <table>
                              <thead><tr><th>दिनांक</th><th className="num">पूर्तता</th><th className="num">पं.स. मान्य</th><th className="num">लेखा परीक्षक मंजूर</th><th>प्रलंबित कारण</th><th></th></tr></thead>
                              <tbody>
                                {logs.map((l) => (
                                  <tr key={l.id}>
                                    <td>{l.log_date?.slice(0, 10)}</td>
                                    <td className="num">{l.complied_count}</td>
                                    <td className="num">{l.ps_accepted_count}</td>
                                    <td className="num">{l.auditor_accepted_count}</td>
                                    <td>{l.pending_reason || '-'}</td>
                                    <td>{can('audit_reports', 'delete') && <button className="btn danger small" onClick={() => deleteLog(l.id, r.id)}>मिटवा</button>}</td>
                                  </tr>
                                ))}
                                {logs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>अद्याप पूर्तता नोंद नाही</td></tr>}
                              </tbody>
                            </table>
                            {canEdit && (
                              <div className="form-grid" style={{ marginTop: 10 }}>
                                <div className="field"><label>दिनांक</label><input type="date" value={logForm.log_date} onChange={(e) => setLogForm({ ...logForm, log_date: e.target.value })} /></div>
                                <div className="field"><label>ग्रा.पं. ने पूर्तता केलेले</label><input type="number" min="0" value={logForm.complied_count} onChange={(e) => setLogForm({ ...logForm, complied_count: e.target.value })} /></div>
                                <div className="field"><label>पंचायत समितीने मान्य केलेले</label><input type="number" min="0" value={logForm.ps_accepted_count} onChange={(e) => setLogForm({ ...logForm, ps_accepted_count: e.target.value })} /></div>
                                <div className="field"><label>लेखा परीक्षकाने मंजूर केलेले</label><input type="number" min="0" value={logForm.auditor_accepted_count} onChange={(e) => setLogForm({ ...logForm, auditor_accepted_count: e.target.value })} /></div>
                                <div className="field" style={{ gridColumn: 'span 2' }}><label>पूर्तता न झाल्याची कारणे</label><input value={logForm.pending_reason} onChange={(e) => setLogForm({ ...logForm, pending_reason: e.target.value })} /></div>
                                <div className="field"><label>&nbsp;</label><button className="btn" type="button" onClick={() => addLog(r.id)}>पूर्तता नोंद जोडा</button></div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
