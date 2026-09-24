import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

const fmt = (n) => Number(n || 0).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { entry_date: today(), kind: 'मिळाले', ref_no: '', ref_date: '', amount: '', remark: '' };

// नमुना १४ - मुद्रांक हिशोब. मिळालेले/वापरलेले मुद्रांक नोंदवा; दैनिक शिल्लक आपोआप.
// (मुद्रांकांचा पैसा नमुना ५/७ मध्ये नेहमीप्रमाणे नोंदतो - येथे फक्त मुद्रांकांचा साठा.)
export default function StampEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    if (!yearId) return;
    client.get('/stamps', { params: { financialYearId: yearId } }).then(({ data }) => setRows(data));
  }
  useEffect(() => { load(); }, [yearId]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post('/stamps', { ...form, financial_year_id: yearId });
      setForm({ ...emptyForm, kind: form.kind }); load();
    } catch (err) { setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली'); } finally { setBusy(false); }
  }
  async function remove(id) {
    setError('');
    try { await client.delete(`/stamps/${id}`); load(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आले नाही'); }
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मुद्रांक हिशोब नोंदणी (नमुना १४) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}
      {can('stamps', 'add') && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>दिनांक</label><input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required /></div>
              <div className="field"><label>प्रकार</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="मिळाले">मिळालेले मुद्रांक</option><option value="वापरले">वापरलेले मुद्रांक</option></select>
              </div>
              <div className="field"><label>{form.kind === 'मिळाले' ? 'प्रमाणक क्रमांक' : 'पत्र/पावती क्रमांक'}</label><input value={form.ref_no} onChange={(e) => setForm({ ...form, ref_no: e.target.value })} /></div>
              {form.kind === 'वापरले' && <div className="field"><label>पत्र/पावती दिनांक</label><input type="date" value={form.ref_date} onChange={(e) => setForm({ ...form, ref_date: e.target.value })} /></div>}
              <div className="field"><label>{form.kind === 'मिळाले' ? 'मुद्रांकांची किंमत' : 'चिकटवलेल्या मुद्रांकांची किंमत'}</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit" disabled={busy}>नोंदवा</button></div>
          </form>
        </div>
      )}
      <div className="card no-print">
        <div className="table-wrap">
          <table>
            <thead><tr><th>दिनांक</th><th>प्रकार</th><th>क्रमांक</th><th className="num">मिळालेले</th><th className="num">वापरलेले</th><th className="num">दैनिक शिल्लक</th><th>शेरा</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.entry_date)}</td><td>{r.kind}</td><td>{r.ref_no || '-'}{r.ref_date ? ` (${fmtDate(r.ref_date)})` : ''}</td>
                  <td className="num">{r.kind === 'मिळाले' ? fmt(r.amount) : ''}</td><td className="num">{r.kind === 'वापरले' ? fmt(r.amount) : ''}</td>
                  <td className="num"><strong>{fmt(r.balance)}</strong></td><td>{r.remark || ''}</td>
                  <td>{can('stamps', 'delete') && i === rows.length - 1 && <button className="btn danger small" type="button" onClick={() => remove(r.id)}>मिटवा</button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
