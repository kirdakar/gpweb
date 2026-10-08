import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const ROAD_TYPES = ['खडीचा', 'बिनखडीचा', 'डांबरी', 'सिमेंटचा'];
const emptyForm = {
  description: '', from_place: '', to_place: '', length_km: '', width_km: '', road_type: '', acquired_date: '', cost_amount: '', remark: '',
};
const emptyExp = {
  expense_date: '', current_repairs: '', current_nature: '', special_repairs: '', special_nature: '', original_construction: '', original_nature: '',
};
const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना २३ (नियम ६८ पाहा) - ताब्यातील रस्त्यांची नोंदवही. रकाने कागदी नमुन्याप्रमाणे: रस्त्याचे नाव, गावापासून/पर्यंत, लांबी/रुंदी
// (किलोमीटर - नमुन्याप्रमाणे), प्रकार, पूर्ण केल्याची तारीख, रस्ता तयार करण्यास आलेला खर्च (प्रति किलोमीटर खर्च आपोआप), दुरुस्त्या
// (चालू/विशेष/मूळ बांधकाम - खर्च व स्वरूप). एकूण खर्च नमुना ४ च्या "रस्ता मालमत्ता" ओळीला आपोआप जातो. (नमुना २२/२४ - स्वतंत्र स्क्रीन.)
export default function RoadAssetEntry() {
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
    client.get('/fixed-assets', { params: { category: 'रस्ते' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setE = (k) => (e) => setExp({ ...exp, [k]: e.target.value });

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      description: r.description || '', from_place: r.from_place || '', to_place: r.to_place || '',
      length_km: r.length_km ?? '', width_km: r.width_km ?? '', road_type: r.road_type || '',
      acquired_date: toDateInput(r.acquired_date), cost_amount: r.cost_amount ?? '', remark: r.remark || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.description.trim()) { setError('रस्त्याचे नाव आवश्यक आहे'); return; }
    setBusy(true);
    try {
      const payload = {
        category: 'रस्ते', description: form.description, from_place: form.from_place, to_place: form.to_place,
        length_km: form.length_km, width_km: form.width_km, road_type: form.road_type,
        acquired_date: form.acquired_date || null, cost_amount: Number(form.cost_amount) || 0, remark: form.remark,
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
  const perKm = (r) => (Number(r.length_km) > 0 ? Number(r.cost_amount) / Number(r.length_km) : null);

  return (
    <div className="page data-entry-page">
      <div className="page-header no-print">
        <h1>ताब्यातील रस्त्यांची नोंदणी (नमुना २३)</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>रस्त्याचे नाव</label><input value={form.description} onChange={set('description')} required /></div>
              <div className="field"><label>गाव - पासून</label><input value={form.from_place} onChange={set('from_place')} /></div>
              <div className="field"><label>गाव - पर्यंत</label><input value={form.to_place} onChange={set('to_place')} /></div>
              <div className="field"><label>लांबी (किलोमीटर)</label><input type="number" step="0.001" min="0" value={form.length_km} onChange={set('length_km')} /></div>
              <div className="field"><label>रुंदी (किलोमीटर - नमुन्याप्रमाणे; उदा. ५ मी = ०.००५)</label><input type="number" step="0.0001" min="0" value={form.width_km} onChange={set('width_km')} /></div>
              <div className="field">
                <label>रस्त्याचा प्रकार</label>
                <select value={form.road_type} onChange={set('road_type')}>
                  <option value="">-- निवडा --</option>
                  {ROAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>पूर्ण केल्याची तारीख</label><input type="date" value={form.acquired_date} onChange={set('acquired_date')} /></div>
              <div className="field"><label>रस्ता तयार करण्यास आलेला एकूण खर्च (रु.)</label><input type="number" step="0.01" min="0" value={form.cost_amount} onChange={set('cost_amount')} required /></div>
              <div className="field"><label>प्रति किलोमीटर खर्च (आपोआप)</label><input readOnly value={Number(form.length_km) > 0 ? fmt(Number(form.cost_amount) / Number(form.length_km)) : ''} /></div>
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
        <h2 style={{ fontSize: 15, marginTop: 0 }}>ताब्यातील रस्ते - यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>रस्त्याचे नाव</th><th>गाव (पासून - पर्यंत)</th><th className="num">लांबी (कि.मी.)</th><th>प्रकार</th><th>पूर्ण तारीख</th><th className="num">खर्च</th><th className="num">प्रति कि.मी.</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.description}</td>
                    <td>{[r.from_place, r.to_place].filter(Boolean).join(' - ') || '-'}</td>
                    <td className="num">{r.length_km != null ? Number(r.length_km) : '-'}</td>
                    <td>{r.road_type || '-'}</td>
                    <td>{fmtDate(r.acquired_date) || '-'}</td>
                    <td className="num">{fmt(r.cost_amount)}</td>
                    <td className="num">{perKm(r) != null ? fmt(perKm(r)) : '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn secondary small" type="button" onClick={() => { setExpAssetId(expAssetId === r.id ? null : r.id); setExp(emptyExp); }}>दुरुस्ती खर्च</button>
                      {can('fixed_assets', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                      {can('fixed_assets', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr className="total-row"><td colSpan={5}>एकूण</td><td className="num">{fmt(total)}</td><td colSpan={2} /></tr></tfoot>}
            </table>
          </div>
        )}
      </div>

      {expAsset && (
        <div className="card no-print">
          <h2 style={{ fontSize: 15, marginTop: 0 }}>दुरुस्ती खर्च - {expAsset.description}</h2>
          {can('fixed_assets', 'edit') && (
            <form onSubmit={addExpense} style={{ marginBottom: 14 }}>
              <div className="form-grid">
                <div className="field"><label>तारीख</label><input type="date" value={exp.expense_date} onChange={setE('expense_date')} required /></div>
                <div className="field"><label>चालू दुरुस्ती - खर्च (रु.)</label><input type="number" step="0.01" min="0" value={exp.current_repairs} onChange={setE('current_repairs')} /></div>
                <div className="field"><label>चालू दुरुस्ती - स्वरूप</label><input value={exp.current_nature} onChange={setE('current_nature')} /></div>
                <div className="field"><label>विशेष दुरुस्ती - खर्च (रु.)</label><input type="number" step="0.01" min="0" value={exp.special_repairs} onChange={setE('special_repairs')} /></div>
                <div className="field"><label>विशेष दुरुस्ती - स्वरूप</label><input value={exp.special_nature} onChange={setE('special_nature')} /></div>
                <div className="field"><label>मूळ बांधकाम - खर्च (रु.)</label><input type="number" step="0.01" min="0" value={exp.original_construction} onChange={setE('original_construction')} /></div>
                <div className="field"><label>मूळ बांधकाम - स्वरूप</label><input value={exp.original_nature} onChange={setE('original_nature')} /></div>
              </div>
              <div style={{ marginTop: 10 }}><button className="btn" type="submit" disabled={busy}>खर्च नोंदवा</button></div>
            </form>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>तारीख</th><th className="num">चालू</th><th>स्वरूप</th><th className="num">विशेष</th><th>स्वरूप</th><th className="num">मूळ बांधकाम</th><th>स्वरूप</th><th></th></tr></thead>
              <tbody>
                {expAsset.expenses.map((x) => (
                  <tr key={x.id}>
                    <td>{fmtDate(x.expense_date)}</td>
                    <td className="num">{fmt(x.current_repairs)}</td><td>{x.current_nature || '-'}</td>
                    <td className="num">{fmt(x.special_repairs)}</td><td>{x.special_nature || '-'}</td>
                    <td className="num">{fmt(x.original_construction)}</td><td>{x.original_nature || x.work_nature || '-'}</td>
                    <td>{can('fixed_assets', 'delete') && <button className="btn danger small" type="button" onClick={() => delExpense(x.id)}>मिटवा</button>}</td>
                  </tr>
                ))}
                {expAsset.expenses.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>खर्चाच्या नोंदी नाहीत</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
