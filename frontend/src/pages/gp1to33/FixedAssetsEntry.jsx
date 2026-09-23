import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const CATEGORIES = [
  { value: 'जंगम', label: 'जंगम मालमत्ता (नमुना १६)' },
  { value: 'स्थावर', label: 'स्थावर मालमत्ता (नमुना २२)' },
  { value: 'रस्ते', label: 'रस्ते (नमुना २३)' },
  { value: 'जमीन', label: 'जमिनी (नमुना २४)' },
];

const emptyForm = {
  description: '', acquired_date: '', acquired_mode: '', quantity_or_measure: '',
  cost_amount: '', disposal_date: '', disposal_details: '', remark: '',
};

// नमुना १६ (जंगम), २२ (स्थावर), २३ (रस्ते), २४ (जमिनी) - एकाच सामायिक
// टेबलवर आधारित चार वेगळ्या मालमत्ता नोंदवह्या (category tabs). स्थावर/
// रस्ते/जमीन च्या बेरजा नमुना ४ च्या A6/A7/A8 ओळींना आपोआप पुरवतात
// (assets_liabilities.routes.js) - तिथे त्या हाताने पुन्हा टाईप करायच्या नाहीत.
export default function FixedAssetsEntry() {
  const { can } = usePermissions();
  const [category, setCategory] = useState('जंगम');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    client.get('/fixed-assets', { params: { category } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [category]);

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      description: row.description || '',
      acquired_date: row.acquired_date ? row.acquired_date.slice(0, 10) : '',
      acquired_mode: row.acquired_mode || '',
      quantity_or_measure: row.quantity_or_measure || '',
      cost_amount: row.cost_amount ?? '',
      disposal_date: row.disposal_date ? row.disposal_date.slice(0, 10) : '',
      disposal_details: row.disposal_details || '',
      remark: row.remark || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) { setError('वर्णन आवश्यक आहे'); return; }
    setBusy(true);
    try {
      const payload = {
        category,
        description: form.description,
        acquired_date: form.acquired_date || null,
        acquired_mode: form.acquired_mode,
        quantity_or_measure: form.quantity_or_measure,
        cost_amount: Number(form.cost_amount) || 0,
        disposal_date: form.disposal_date || null,
        disposal_details: form.disposal_details,
        remark: form.remark,
      };
      if (editingId) {
        await client.put(`/fixed-assets/${editingId}`, payload);
      } else {
        await client.post('/fixed-assets', payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('ही नोंद मिटवायची आहे का?')) return;
    await client.delete(`/fixed-assets/${id}`);
    load();
  }

  const total = rows.reduce((s, r) => s + Number(r.cost_amount || 0), 0);
  const canEdit = can('fixed_assets', 'add') || can('fixed_assets', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मालमत्ता नोंदणी (नमुना १६/२२/२३/२४)</h1>
        <CloseReportButton />
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" className={`btn ${category === c.value ? '' : 'secondary'}`}
              onClick={() => { setCategory(c.value); cancelEdit(); }}>{c.label}</button>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>वर्णन</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="field">
                <label>प्राप्त/संपादित दिनांक</label>
                <input type="date" value={form.acquired_date} onChange={(e) => setForm({ ...form, acquired_date: e.target.value })} />
              </div>
              <div className="field">
                <label>कोणत्या कारणासाठी/आधारे (खरेदी/हस्तांतरण इ.)</label>
                <input value={form.acquired_mode} onChange={(e) => setForm({ ...form, acquired_mode: e.target.value })} />
              </div>
              <div className="field">
                <label>संख्या/परिमाण</label>
                <input value={form.quantity_or_measure} onChange={(e) => setForm({ ...form, quantity_or_measure: e.target.value })} />
              </div>
              <div className="field">
                <label>रक्कम/किंमत</label>
                <input type="number" step="0.01" min="0" value={form.cost_amount} onChange={(e) => setForm({ ...form, cost_amount: e.target.value })} required />
              </div>
              <div className="field">
                <label>विल्हेवाट दिनांक (असल्यास)</label>
                <input type="date" value={form.disposal_date} onChange={(e) => setForm({ ...form, disposal_date: e.target.value })} />
              </div>
              <div className="field">
                <label>विल्हेवाट तपशील</label>
                <input value={form.disposal_details} onChange={(e) => setForm({ ...form, disposal_details: e.target.value })} />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>शेरा</label>
                <input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>{CATEGORIES.find((c) => c.value === category)?.label} - यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>वर्णन</th><th>दिनांक</th><th>आधार</th><th>संख्या/परिमाण</th><th className="num">रक्कम</th><th>विल्हेवाट</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.description}</td>
                    <td>{r.acquired_date?.slice(0, 10) || '-'}</td>
                    <td>{r.acquired_mode || '-'}</td>
                    <td>{r.quantity_or_measure || '-'}</td>
                    <td className="num">{Number(r.cost_amount).toFixed(2)}</td>
                    <td>{r.disposal_date ? `${r.disposal_date.slice(0, 10)} - ${r.disposal_details || ''}` : '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {can('fixed_assets', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                      {can('fixed_assets', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="total-row"><td colSpan={4}>एकूण</td><td className="num">{total.toFixed(2)}</td><td colSpan={2} /></tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
