import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const emptyForm = {
  description: '', acquired_date: '', purpose: '', acquired_from: '', acquired_mode: '', quantity_or_measure: '', survey_no: '',
  land_assessment: '', land_boundary: '', buildings_info: '', cost_amount: '',
  disposal_details: '', recovered_amount: '', disposal_voucher: '', disposal_resolution: '', disposal_authority: '', disposal_date: '', remark: '',
};
const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना २४ (नियम ६९ पाहा) - जमिनीची नोंदवही. रकाने कागदी नमुन्याप्रमाणे: हस्तांतरित/खरेदी/संपादित केल्याची तारीख, कारण, कोणाकडून,
// करारनामा/निवाडा निर्देश, क्षेत्रफळ, भूमापन क्रमांक, आकारणी, सीमा, जमिनीसह संपादित इमारती, विल्हेवाट (वर्णन, विक्रीची रक्कम,
// प्रमाणक, ठराव, कलम ५५ आदेश), शेरा. जमिनीची किंमत कागदी नमुन्यात नाही, पण नमुना ४ च्या "जमिनीची मालमत्ता" ओळीसाठी आवश्यक -
// ती फक्त त्या एकूणासाठी वापरली जाते, नमुना २४ च्या छापात येत नाही.
export default function LandAssetEntry() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    client.get('/fixed-assets', { params: { category: 'जमीन' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      description: r.description || '', acquired_date: toDateInput(r.acquired_date), purpose: r.purpose || '',
      acquired_from: r.acquired_from || '', acquired_mode: r.acquired_mode || '', quantity_or_measure: r.quantity_or_measure || '',
      survey_no: r.survey_no || '', land_assessment: r.land_assessment || '', land_boundary: r.land_boundary || '',
      buildings_info: r.buildings_info || '', cost_amount: r.cost_amount ?? '',
      disposal_details: r.disposal_details || '', recovered_amount: r.recovered_amount ?? '', disposal_voucher: r.disposal_voucher || '',
      disposal_resolution: r.disposal_resolution || '', disposal_authority: r.disposal_authority || '',
      disposal_date: toDateInput(r.disposal_date), remark: r.remark || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) { setError('जमिनीचे वर्णन/नाव आवश्यक आहे'); return; }
    setBusy(true);
    try {
      const payload = {
        category: 'जमीन', ...form,
        acquired_date: form.acquired_date || null, disposal_date: form.disposal_date || null,
        cost_amount: Number(form.cost_amount) || 0,
        recovered_amount: form.recovered_amount === '' ? '' : Number(form.recovered_amount),
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
        <h1>जमिनींची नोंदणी (नमुना २४)</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>जमिनीचे वर्णन / नाव</label><input value={form.description} onChange={set('description')} required /></div>
              <div className="field"><label>हस्तांतरित/खरेदी/संपादित केल्याची तारीख</label><input type="date" value={form.acquired_date} onChange={set('acquired_date')} /></div>
              <div className="field"><label>कोणत्या कारणासाठी</label><input value={form.purpose} onChange={set('purpose')} /></div>
              <div className="field"><label>कोणाकडून</label><input value={form.acquired_from} onChange={set('acquired_from')} /></div>
              <div className="field"><label>करारनामा, निवाडा इत्यादींचा निर्देश</label><input value={form.acquired_mode} onChange={set('acquired_mode')} /></div>
              <div className="field"><label>जमिनीचे क्षेत्रफळ</label><input value={form.quantity_or_measure} onChange={set('quantity_or_measure')} /></div>
              <div className="field"><label>भूमापन क्रमांक इत्यादी</label><input value={form.survey_no} onChange={set('survey_no')} /></div>
              <div className="field"><label>आकारणी</label><input value={form.land_assessment} onChange={set('land_assessment')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>जमिनीची सीमा</label><input value={form.land_boundary} onChange={set('land_boundary')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>जमिनीसह खरेदी/संपादन केलेल्या इमारती (असल्यास)</label><input value={form.buildings_info} onChange={set('buildings_info')} /></div>
              <div className="field"><label>जमिनीची किंमत (रु.) - नमुना ४ साठी</label><input type="number" step="0.01" min="0" value={form.cost_amount} onChange={set('cost_amount')} required /></div>
            </div>
            <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>विल्हेवाट (असल्यास)</h3>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>जमिनीची व इमारतीची विल्हेवाट</label><input value={form.disposal_details} onChange={set('disposal_details')} /></div>
              <div className="field"><label>विक्रीपासून मिळालेली रक्कम (रु.)</label><input type="number" step="0.01" min="0" value={form.recovered_amount} onChange={set('recovered_amount')} /></div>
              <div className="field"><label>प्रमाणकाचा क्रमांक व दिनांक</label><input value={form.disposal_voucher} onChange={set('disposal_voucher')} /></div>
              <div className="field"><label>पंचायतीचा ठराव क्रमांक व तारीख</label><input value={form.disposal_resolution} onChange={set('disposal_resolution')} /></div>
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

      <div className="card no-print">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>जमिनी - यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>वर्णन</th><th>तारीख</th><th>कोणाकडून</th><th>क्षेत्रफळ</th><th>भूमापन क्र.</th><th className="num">किंमत</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.description}</td>
                    <td>{fmtDate(r.acquired_date) || '-'}</td>
                    <td>{r.acquired_from || '-'}</td>
                    <td>{r.quantity_or_measure || '-'}</td>
                    <td>{r.survey_no || '-'}</td>
                    <td className="num">{fmt(r.cost_amount)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {can('fixed_assets', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                      {can('fixed_assets', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr className="total-row"><td colSpan={5}>एकूण</td><td className="num">{fmt(total)}</td><td /></tr></tfoot>}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
