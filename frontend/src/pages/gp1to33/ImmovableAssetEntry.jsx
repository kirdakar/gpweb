import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const CLASSES = [
  { v: '', label: '-- वर्ग निवडा --' },
  { v: '1', label: 'वर्ग १ - निवडक सामग्री वापरलेली पहिल्या वर्गाची मजबूत इमारत (२.५%)' },
  { v: '2', label: 'वर्ग २ - कमी मजबूत बांधकामाची दुसऱ्या वर्गाची इमारत (५.०%)' },
  { v: '3', label: 'वर्ग ३ - दुसऱ्या वर्गापेक्षा कनिष्ठ, निव्वळ तात्पुरती उभारणी नसलेली इमारत (७.५%)' },
  { v: '4', label: 'वर्ग ४ - लाकडी बांधकामासारखे निव्वळ तात्पुरते इमले (दर विहित नाही)' },
];
const emptyForm = {
  description: '', survey_no: '', acquired_date: '', acquired_mode: '', purpose: '', cost_amount: '', asset_class: '',
  disposal_details: '', disposal_authority: '', disposal_date: '', remark: '',
};
const emptyExp = { expense_date: '', current_repairs: '', special_repairs: '', original_construction: '', work_nature: '' };
const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना २२ (नियम ५७(१) पाहा) - स्थावर मालमत्ता नोंदवही (रस्ते व जमिनीव्यतिरिक्त). रकाने कागदी नमुन्याप्रमाणे: संपादनाची तारीख,
// आदेश/ठराव क्रमांक व दिनांक, भूखंड क्रमांक व वर्णन, वापराचे कारण, उभारणी/संपादन खर्च, वर्षभरातील दुरुस्ती/फेरफार खर्चाच्या नोंदी
// (तारीख, चालू/विशेष दुरुस्त्या, मूळ बांधकाम, कामाचे स्वरूप), विल्हेवाटीचा ठराव/आदेश. "वर्ष अखेरीस घटलेली किंमत" रिपोर्टमध्ये
// मालमत्तेच्या वर्गाच्या दरावरून आपोआप. (नमुना २३/२४ - रस्ते/जमिनी - स्वतंत्र स्क्रीनवर, FixedAssetsEntry.jsx.)
export default function ImmovableAssetEntry() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expAssetId, setExpAssetId] = useState(null);
  const [exp, setExp] = useState(emptyExp);

  function load() {
    setLoading(true);
    client.get('/fixed-assets', { params: { category: 'स्थावर' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      description: r.description || '', survey_no: r.survey_no || '', acquired_date: r.acquired_date ? toDateInput(r.acquired_date) : '',
      acquired_mode: r.acquired_mode || '', purpose: r.purpose || '', cost_amount: r.cost_amount ?? '',
      asset_class: r.asset_class ? String(r.asset_class) : '', disposal_details: r.disposal_details || '',
      disposal_authority: r.disposal_authority || '', disposal_date: r.disposal_date ? toDateInput(r.disposal_date) : '', remark: r.remark || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) { setError('मालमत्तेचे वर्णन आवश्यक आहे'); return; }
    setBusy(true);
    try {
      const payload = {
        category: 'स्थावर', description: form.description, survey_no: form.survey_no, acquired_date: form.acquired_date || null,
        acquired_mode: form.acquired_mode, purpose: form.purpose, cost_amount: Number(form.cost_amount) || 0,
        asset_class: form.asset_class, disposal_details: form.disposal_details, disposal_authority: form.disposal_authority,
        disposal_date: form.disposal_date || null, remark: form.remark,
      };
      if (editingId) await client.put(`/fixed-assets/${editingId}`, payload);
      else await client.post('/fixed-assets', payload);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('ही नोंद (व तिच्या खर्चाच्या नोंदी) मिटवायची आहे का?')) return;
    await client.delete(`/fixed-assets/${id}`);
    if (expAssetId === id) setExpAssetId(null);
    load();
  }

  async function addExpense(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post(`/fixed-assets/${expAssetId}/expenses`, exp);
      setExp(emptyExp);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'खर्च नोंदवताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }
  async function delExpense(id) {
    await client.delete(`/fixed-assets/expenses/${id}`);
    load();
  }

  const canEdit = can('fixed_assets', 'add') || can('fixed_assets', 'edit');
  const total = rows.reduce((s, r) => s + Number(r.cost_amount || 0), 0);
  const expAsset = rows.find((r) => r.id === expAssetId);

  return (
    <div className="page data-entry-page">
      <div className="page-header no-print">
        <h1>स्थावर मालमत्ता नोंदणी (नमुना २२)</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>मालमत्तेचे वर्णन</label><input value={form.description} onChange={set('description')} required /></div>
              <div className="field"><label>भूखंडाचा/भूमापन क्रमांक</label><input value={form.survey_no} onChange={set('survey_no')} /></div>
              <div className="field"><label>संपादनाची/खरेदीची/उभारणीची तारीख</label><input type="date" value={form.acquired_date} onChange={set('acquired_date')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>ज्याअन्वये मालमत्ता संपादित केली त्या आदेशाचे व पंचायत ठरावाचे क्रमांक व दिनांक</label><input value={form.acquired_mode} onChange={set('acquired_mode')} /></div>
              <div className="field"><label>कोणत्या कारणासाठी वापर केला</label><input value={form.purpose} onChange={set('purpose')} /></div>
              <div className="field"><label>उभारणीचा किंवा संपादनाचा खर्च (रु.)</label><input type="number" step="0.01" min="0" value={form.cost_amount} onChange={set('cost_amount')} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>मालमत्तेचा वर्ग (घसाऱ्याचा दर ठरवण्यासाठी)</label>
                <select value={form.asset_class} onChange={set('asset_class')}>{CLASSES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
              </div>
            </div>
            <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>विल्हेवाट (असल्यास)</h3>
            <div className="form-grid">
              <div className="field"><label>विल्हेवाटीसाठी पंचायतीच्या ठरावाचा क्रमांक</label><input value={form.disposal_details} onChange={set('disposal_details')} /></div>
              <div className="field"><label>कलम ५५ खालील प्राधिकाऱ्याच्या आदेशाचा क्रमांक</label><input value={form.disposal_authority} onChange={set('disposal_authority')} /></div>
              <div className="field"><label>आदेशाची तारीख</label><input type="date" value={form.disposal_date} onChange={set('disposal_date')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={set('remark')} /></div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>स्थावर मालमत्ता - यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>वर्णन (भूखंड क्र.)</th><th>तारीख</th><th>आदेश/ठराव</th><th className="num">खर्च</th><th>वर्ग</th><th className="num">दुरुस्ती खर्च</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={expAssetId === r.id ? { background: 'var(--surface-alt, #eef2ff)' } : undefined}>
                    <td>{r.description}{r.survey_no ? ` (${r.survey_no})` : ''}</td>
                    <td>{fmtDate(r.acquired_date) || '-'}</td>
                    <td>{r.acquired_mode || '-'}</td>
                    <td className="num">{fmt(r.cost_amount)}</td>
                    <td>{r.asset_class || '-'}</td>
                    <td className="num">{fmt(r.expenses.reduce((s, x) => s + Number(x.current_repairs) + Number(x.special_repairs) + Number(x.original_construction), 0))}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn secondary small" type="button" onClick={() => { setExpAssetId(expAssetId === r.id ? null : r.id); setExp(emptyExp); }}>खर्च नोंदी</button>
                      {can('fixed_assets', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                      {can('fixed_assets', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr className="total-row"><td colSpan={3}>एकूण</td><td className="num">{fmt(total)}</td><td colSpan={3} /></tr></tfoot>}
            </table>
          </div>
        )}
      </div>

      {expAsset && (
        <div className="card no-print">
          <h2 style={{ fontSize: 15, marginTop: 0 }}>दुरुस्ती / फेरफार खर्च - {expAsset.description}</h2>
          {can('fixed_assets', 'edit') && (
            <form onSubmit={addExpense} style={{ marginBottom: 14 }}>
              <div className="form-grid">
                <div className="field"><label>तारीख</label><input type="date" value={exp.expense_date} onChange={(e) => setExp({ ...exp, expense_date: e.target.value })} required /></div>
                <div className="field"><label>चालू दुरुस्त्या (रु.)</label><input type="number" step="0.01" min="0" value={exp.current_repairs} onChange={(e) => setExp({ ...exp, current_repairs: e.target.value })} /></div>
                <div className="field"><label>विशेष दुरुस्त्या (रु.)</label><input type="number" step="0.01" min="0" value={exp.special_repairs} onChange={(e) => setExp({ ...exp, special_repairs: e.target.value })} /></div>
                <div className="field"><label>मूळ बांधकाम (रु.)</label><input type="number" step="0.01" min="0" value={exp.original_construction} onChange={(e) => setExp({ ...exp, original_construction: e.target.value })} /></div>
                <div className="field" style={{ gridColumn: 'span 2' }}><label>मूळ बांधकामाचे कामाचे स्वरूप</label><input value={exp.work_nature} onChange={(e) => setExp({ ...exp, work_nature: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: 10 }}><button className="btn" type="submit" disabled={busy}>खर्च नोंदवा</button></div>
            </form>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>तारीख</th><th className="num">चालू दुरुस्त्या</th><th className="num">विशेष दुरुस्त्या</th><th className="num">मूळ बांधकाम</th><th>कामाचे स्वरूप</th><th></th></tr></thead>
              <tbody>
                {expAsset.expenses.map((x) => (
                  <tr key={x.id}>
                    <td>{fmtDate(x.expense_date)}</td><td className="num">{fmt(x.current_repairs)}</td><td className="num">{fmt(x.special_repairs)}</td>
                    <td className="num">{fmt(x.original_construction)}</td><td>{x.work_nature || '-'}</td>
                    <td>{can('fixed_assets', 'delete') && <button className="btn danger small" type="button" onClick={() => delExpense(x.id)}>मिटवा</button>}</td>
                  </tr>
                ))}
                {expAsset.expenses.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>खर्चाच्या नोंदी नाहीत</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
