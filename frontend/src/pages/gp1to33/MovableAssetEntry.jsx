import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const emptyForm = {
  description: '', acquired_mode: '', acquired_date: '', quantity_or_measure: '', cost_amount: '',
  disposal_date: '', disposal_quantity: '', disposal_details: '', disposal_authority: '',
  recovered_amount: '', recovered_deposit_date: '', remark: '',
};

// नमुना १६ (नियम ४७(५) पाहा) - जडवस्तू संग्रह किंवा जंगम मालमत्ता नोंदवही. रकाने कागदी नमुन्याप्रमाणे:
// वस्तूचे वर्णन, खरेदीचे प्राधिकार व तारीख, संख्या/परिमाण, किंमत, अंतिम विल्हेवाट (संख्या/परिमाण, स्वरूप, प्राधिकार पत्र
// किंवा प्रमाणक), वसूल केलेली रक्कम व कोषागारात भरल्याची तारीख, शेरा. "साठ्यातील शिल्लक" रकाना अहवालात संख्यांवरून आपोआप.
// (नमुना २२/२३/२४ ची स्थावर मालमत्ता स्वतंत्र स्क्रीनवर - FixedAssetsEntry.jsx.)
export default function MovableAssetEntry() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    client.get('/fixed-assets', { params: { category: 'जंगम' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      description: r.description || '', acquired_mode: r.acquired_mode || '',
      acquired_date: r.acquired_date ? toDateInput(r.acquired_date) : '', quantity_or_measure: r.quantity_or_measure || '',
      cost_amount: r.cost_amount ?? '', disposal_date: r.disposal_date ? toDateInput(r.disposal_date) : '',
      disposal_quantity: r.disposal_quantity || '', disposal_details: r.disposal_details || '',
      disposal_authority: r.disposal_authority || '', recovered_amount: r.recovered_amount ?? '',
      recovered_deposit_date: r.recovered_deposit_date ? toDateInput(r.recovered_deposit_date) : '', remark: r.remark || '',
    });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) { setError('वस्तूचे वर्णन आवश्यक आहे'); return; }
    setBusy(true);
    try {
      const payload = {
        category: 'जंगम',
        description: form.description, acquired_mode: form.acquired_mode, acquired_date: form.acquired_date || null,
        quantity_or_measure: form.quantity_or_measure, cost_amount: Number(form.cost_amount) || 0,
        disposal_date: form.disposal_date || null, disposal_quantity: form.disposal_quantity,
        disposal_details: form.disposal_details, disposal_authority: form.disposal_authority,
        recovered_amount: form.recovered_amount === '' ? '' : Number(form.recovered_amount),
        recovered_deposit_date: form.recovered_deposit_date || null, remark: form.remark,
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
    if (!window.confirm('ही नोंद मिटवायची आहे का?')) return;
    await client.delete(`/fixed-assets/${id}`);
    load();
  }

  const canEdit = can('fixed_assets', 'add') || can('fixed_assets', 'edit');
  const total = rows.reduce((s, r) => s + Number(r.cost_amount || 0), 0);

  return (
    <div className="page data-entry-page">
      <div className="page-header no-print">
        <h1>जंगम मालमत्ता / जडवस्तू संग्रह नोंदणी (नमुना १६)</h1>
        <CloseReportButton />
      </div>

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>वस्तूचे वर्णन</label><input value={form.description} onChange={set('description')} required /></div>
              <div className="field"><label>खरेदीचे प्राधिकार (ठराव/आदेश क्र.)</label><input value={form.acquired_mode} onChange={set('acquired_mode')} /></div>
              <div className="field"><label>खरेदीची तारीख</label><input type="date" value={form.acquired_date} onChange={set('acquired_date')} /></div>
              <div className="field"><label>संख्या किंवा परिमाण</label><input value={form.quantity_or_measure} onChange={set('quantity_or_measure')} /></div>
              <div className="field"><label>किंमत (रु.)</label><input type="number" step="0.01" min="0" value={form.cost_amount} onChange={set('cost_amount')} required /></div>
            </div>
            <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>अंतिम विल्हेवाट (असल्यास)</h3>
            <div className="form-grid">
              <div className="field"><label>विल्हेवाटीची तारीख</label><input type="date" value={form.disposal_date} onChange={set('disposal_date')} /></div>
              <div className="field"><label>संख्या किंवा परिमाण (विल्हेवाट)</label><input value={form.disposal_quantity} onChange={set('disposal_quantity')} /></div>
              <div className="field"><label>विल्हेवाटीचे स्वरूप</label><input value={form.disposal_details} onChange={set('disposal_details')} /></div>
              <div className="field"><label>प्राधिकार पत्र किंवा प्रमाणक</label><input value={form.disposal_authority} onChange={set('disposal_authority')} /></div>
              <div className="field"><label>वसूल केलेली रक्कम (रु.)</label><input type="number" step="0.01" min="0" value={form.recovered_amount} onChange={set('recovered_amount')} /></div>
              <div className="field"><label>कोषागारात भरल्याची तारीख</label><input type="date" value={form.recovered_deposit_date} onChange={set('recovered_deposit_date')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={set('remark')} /></div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>जंगम मालमत्ता - यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>वस्तूचे वर्णन</th><th>खरेदी (प्राधिकार / तारीख)</th><th>संख्या/परिमाण</th><th className="num">किंमत</th><th>विल्हेवाट</th><th className="num">वसूल रक्कम</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.description}</td>
                    <td>{[r.acquired_mode, r.acquired_date ? fmtDate(r.acquired_date) : ''].filter(Boolean).join(' / ') || '-'}</td>
                    <td>{r.quantity_or_measure || '-'}</td>
                    <td className="num">{Number(r.cost_amount).toFixed(2)}</td>
                    <td>{[r.disposal_date ? fmtDate(r.disposal_date) : '', r.disposal_quantity, r.disposal_details].filter(Boolean).join(' - ') || '-'}</td>
                    <td className="num">{r.recovered_amount != null ? Number(r.recovered_amount).toFixed(2) : '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {can('fixed_assets', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                      {can('fixed_assets', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr className="total-row"><td colSpan={3}>एकूण</td><td className="num">{total.toFixed(2)}</td><td colSpan={3} /></tr></tfoot>}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
