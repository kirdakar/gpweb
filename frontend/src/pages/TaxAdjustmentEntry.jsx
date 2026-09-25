import { useEffect, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import CloseReportButton from '../components/CloseReportButton';
import { fmtDate } from '../utils/formatDate';

const COMPONENTS = [
  { key: 'gharpatti', label: 'घरपट्टी' },
  { key: 'divabatti', label: 'दिवाबत्ती' },
  { key: 'arogya', label: 'आरोग्य कर' },
  { key: 'panipatti', label: 'पाणीपट्टी' },
];
const emptyForm = {
  scope: 'सर्व', property_code: '', kind: 'सूट', applies_to: 'चालू',
  on_gharpatti: true, on_divabatti: false, on_arogya: false, on_panipatti: false,
  mode: 'टक्के', value: '', reason: '', order_no: '', order_date: '',
};

// घरपट्टी सूट / दंड नोंदणी - सर्वांना किंवा एका व्यक्तीस (कोड), टक्के किंवा रक्कम, मागील /
// चालू / दोन्ही बाकीवर. आकारणी बदलत नाही; येणे बाकी, कर जमा भरणे, नमुना ९क, येणे बाकी अहवाल,
// डॅशबोर्ड सर्वत्र निव्वळ रक्कम आपोआप दिसते.
export default function TaxAdjustmentEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    if (!yearId) return;
    client.get('/tax-adjustments', { params: { financialYearId: yearId } }).then(({ data }) => setRows(data));
  }
  useEffect(() => { load(); setPreview(null); }, [yearId]);

  const payload = () => ({ ...form, financial_year_id: yearId });
  const set = (patch) => { setForm({ ...form, ...patch }); setPreview(null); };

  async function doPreview() {
    setError(''); setNotice('');
    try {
      const { data } = await client.post('/tax-adjustments/preview', payload());
      setPreview(data);
    } catch (err) { setPreview(null); setError(err.response?.data?.error || 'परिणाम काढता आला नाही'); }
  }

  async function save(e) {
    e.preventDefault();
    setError(''); setNotice('');
    setBusy(true);
    try {
      await client.post('/tax-adjustments', payload());
      setNotice(`${form.kind} लागू केली - कर जमा भरणे, नमुना ९क, येणे बाकी अहवाल व डॅशबोर्डवर आता निव्वळ रक्कम दिसेल.`);
      setForm(emptyForm); setPreview(null); load();
    } catch (err) { setError(err.response?.data?.error || 'जतन करताना त्रुटी आली'); } finally { setBusy(false); }
  }

  async function toggle(r) {
    await client.patch(`/tax-adjustments/${r.id}/active`, { is_active: !r.is_active });
    load();
  }
  async function remove(r) {
    if (!window.confirm('हा नियम मिटवायचा आहे का? (बाकी पूर्ववत होईल)')) return;
    await client.delete(`/tax-adjustments/${r.id}`);
    load();
  }

  const describe = (r) => {
    const comps = COMPONENTS.filter((c) => r[`on_${c.key}`]).map((c) => c.label).join(', ');
    const val = r.mode === 'टक्के' ? `${Number(r.value)}%` : `₹${Number(r.value).toFixed(2)}`;
    return `${comps} — ${val}`;
  };
  const canAdd = can('tax_adjustments', 'add');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>घरपट्टी सूट / दंड नोंदणी {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="notice-box">{notice}</div>}

      {canAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>कोणाला</label>
                <select value={form.scope} onChange={(e) => set({ scope: e.target.value })}>
                  <option value="सर्व">सर्वांना</option><option value="एक">एका व्यक्तीस (कोड)</option>
                </select>
              </div>
              {form.scope === 'एक' && (
                <div className="field"><label>व्यक्तीचा कोड</label><input type="number" min="1" value={form.property_code} onChange={(e) => set({ property_code: e.target.value })} required /></div>
              )}
              <div className="field">
                <label>प्रकार</label>
                <select value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
                  <option value="सूट">सूट (वजा)</option><option value="दंड">दंड (जोडा)</option>
                </select>
              </div>
              <div className="field">
                <label>कोणत्या बाकीवर</label>
                <select value={form.applies_to} onChange={(e) => set({ applies_to: e.target.value })}>
                  <option value="चालू">चालू बाकी</option><option value="मागील">मागील बाकी</option><option value="दोन्ही">मागील + चालू दोन्ही</option>
                </select>
              </div>
              <div className="field">
                <label>टक्के / रक्कम</label>
                <select value={form.mode} onChange={(e) => set({ mode: e.target.value })}>
                  <option value="टक्के">टक्केवारी (%)</option><option value="रक्कम">रक्कम (₹, प्रत्येक व्यक्तीस)</option>
                </select>
              </div>
              <div className="field"><label>{form.mode === 'टक्के' ? 'टक्केवारी' : 'रक्कम (₹)'}</label><input type="number" step="0.01" min="0" value={form.value} onChange={(e) => set({ value: e.target.value })} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>कोणत्या कराला लागू</label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {COMPONENTS.map((c) => (
                    <label key={c.key} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                      <input type="checkbox" checked={form[`on_${c.key}`]} onChange={(e) => set({ [`on_${c.key}`]: e.target.checked })} /> {c.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>कारण</label><input value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></div>
              <div className="field"><label>ठराव/आदेश क्र.</label><input value={form.order_no} onChange={(e) => set({ order_no: e.target.value })} /></div>
              <div className="field"><label>ठराव/आदेश दिनांक</label><input type="date" value={form.order_date} onChange={(e) => set({ order_date: e.target.value })} /></div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>
              रक्कम निवडल्यास ती प्रत्येक व्यक्तीस (कोडास) लागते व निवडलेल्या बाकीत मूळ रकमेच्या प्रमाणात वाटली जाते. सूट मूळ रकमेपेक्षा जास्त होत नाही.
            </p>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn secondary" type="button" onClick={doPreview}>परिणाम पहा</button>
              <button className="btn" type="submit" disabled={busy || !preview}>{form.kind} लागू करा</button>
              {preview && <strong>{preview.persons} व्यक्तींना, एकूण ₹{preview.total.toFixed(2)} {form.kind}</strong>}
              {!preview && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>लागू करण्याआधी "परिणाम पहा" दाबा</span>}
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>प्रकार</th><th>कोणाला</th><th>बाकी</th><th>कर व मूल्य</th><th>कारण / आदेश</th><th>स्थिती</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                <td style={{ fontWeight: 700, color: r.kind === 'सूट' ? 'var(--success)' : 'var(--danger)' }}>{r.kind}</td>
                <td>{r.scope === 'सर्व' ? 'सर्वांना' : `कोड ${r.property_code}${r.owner_name ? ` - ${r.owner_name}` : ''}`}</td>
                <td>{r.applies_to}</td>
                <td>{describe(r)}</td>
                <td>{r.reason || '-'}{r.order_no ? ` | ${r.order_no}` : ''}{r.order_date ? ` (${fmtDate(r.order_date)})` : ''}</td>
                <td>{r.is_active ? 'लागू' : 'बंद'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {can('tax_adjustments', 'edit') && <button className="btn secondary small" type="button" onClick={() => toggle(r)}>{r.is_active ? 'बंद करा' : 'पुन्हा लागू करा'}</button>}
                  {can('tax_adjustments', 'delete') && <button className="btn danger small" type="button" onClick={() => remove(r)}>मिटवा</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>या वर्षासाठी सूट/दंड नाही</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
