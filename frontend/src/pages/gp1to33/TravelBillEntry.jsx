import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const emptyForm = {
  traveller_name: '', travel_date: '', from_place: '', to_place: '', purpose: '',
  fare_amount: '', mileage_km: '', mileage_rate: '', daily_allowance_days: '', daily_allowance_rate: '', remark: '',
  office_place: '', depart_time: '', arrival_date: '', arrival_time: '', transport_mode: '', travel_class: '', ticket_count: '', vehicle_name: '', enclosures: '',
};
const EXTRA_KEYS = ['office_place', 'depart_time', 'arrival_date', 'arrival_time', 'transport_mode', 'travel_class', 'ticket_count', 'vehicle_name', 'enclosures', 'remark'];

// नमुना ३१ - प्रवास भत्ता देयक. भाडे + मैल भत्ता + दैनिक भत्ता यांची बेरीज
// नोंद करताच रोकड वहीत (नमुना ५) खर्च नोंदते - रक्कम दुसऱ्यांदा टाईप करायची
// नाही. प्रिंट अहवाल रिपोर्ट मेन्यूत.
export default function TravelBillEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const [heads, setHeads] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [headSearch, setHeadSearch] = useState('');
  const [headDropdownOpen, setHeadDropdownOpen] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // नमुना ३१ चे कागदी रकाने नंतर पूर्ण करण्यासाठी (निवडलेले देयक)
  const [detailId, setDetailId] = useState('');
  const [detail, setDetail] = useState(Object.fromEntries(EXTRA_KEYS.map((k) => [k, ''])));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);
  useEffect(() => { setForm((f) => ({ ...f, travel_date: new Date().toISOString().slice(0, 10) })); }, []);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/travel-bills', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === 'खर्च'), [heads]);
  const headSearchTerm = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => {
    if (!headSearchTerm) return leafHeads;
    return leafHeads.filter((h) => h.name.toLowerCase().includes(headSearchTerm) || h.code.toLowerCase().includes(headSearchTerm));
  }, [leafHeads, headSearchTerm]);

  function selectHead(h) { setSelectedHeadId(h.id); setHeadSearch(`${h.code} - ${h.name}`); setHeadDropdownOpen(false); }
  function resetForm() { setForm({ ...emptyForm, travel_date: new Date().toISOString().slice(0, 10) }); setSelectedHeadId(''); setHeadSearch(''); }

  const mileageAmount = (Number(form.mileage_km) || 0) * (Number(form.mileage_rate) || 0);
  const dailyAmount = (Number(form.daily_allowance_days) || 0) * (Number(form.daily_allowance_rate) || 0);
  const total = (Number(form.fare_amount) || 0) + mileageAmount + dailyAmount;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.traveller_name.trim()) { setError('नाव आवश्यक आहे'); return; }
    if (!selectedHeadId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    if (total <= 0) { setError('एकूण रक्कम शून्यापेक्षा जास्त हवी'); return; }
    setBusy(true);
    try {
      await client.post('/travel-bills', { ...form, financial_year_id: yearId, ledger_head_id: selectedHeadId });
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  // निवडलेल्या देयकाचे कागदी रकाने फॉर्ममध्ये भरतो; यादी बदलली तर पहिले निवडतो
  useEffect(() => {
    if (rows.length === 0) { setDetailId(''); return; }
    if (!rows.some((r) => String(r.id) === String(detailId))) setDetailId(String(rows[0].id));
  }, [rows]);
  useEffect(() => {
    const r = rows.find((x) => String(x.id) === String(detailId));
    setDetail(Object.fromEntries(EXTRA_KEYS.map((k) => [k, r ? (k === 'arrival_date' ? toDateInput(r[k]) : (r[k] ?? '')) : ''])));
  }, [detailId, rows]);
  async function saveDetail(e) {
    e.preventDefault();
    setError('');
    try {
      await client.put(`/travel-bills/${detailId}/details`, detail);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }
  const setD = (k) => (e) => setDetail({ ...detail, [k]: e.target.value });

  const canAdd = can('travel_bills', 'add');
  const canEditBill = can('travel_bills', 'edit');

  return (
    <div className="page data-entry-page">
      <div className="page-header no-print">
        <h1>प्रवास भत्ता देयक नोंदणी (नमुना ३१) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>

      {canAdd && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>नाव (सरपंच/सदस्य/कर्मचारी)</label><input value={form.traveller_name} onChange={(e) => setForm({ ...form, traveller_name: e.target.value })} required /></div>
              <div className="field"><label>दिनांक</label><input type="date" value={form.travel_date} onChange={(e) => setForm({ ...form, travel_date: e.target.value })} required /></div>
              <div className="field"><label>कोठून</label><input value={form.from_place} onChange={(e) => setForm({ ...form, from_place: e.target.value })} /></div>
              <div className="field"><label>कोठे</label><input value={form.to_place} onChange={(e) => setForm({ ...form, to_place: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>प्रवासाचे कारण</label><input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
              <div className="field"><label>कार्यालयाचे ठिकाण</label><input value={form.office_place} onChange={(e) => setForm({ ...form, office_place: e.target.value })} /></div>
              <div className="field"><label>निर्गमन वेळ</label><input value={form.depart_time} onChange={(e) => setForm({ ...form, depart_time: e.target.value })} placeholder="उदा. सकाळी ९:००" /></div>
              <div className="field"><label>आगमन दिनांक</label><input type="date" value={form.arrival_date} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} /></div>
              <div className="field"><label>आगमन वेळ</label><input value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} /></div>
              <div className="field"><label>प्रवासाचे साधन (रेल्वे मेल/पॅसेंजर, बोट, रस्ता, ट्रॉली)</label><input value={form.transport_mode} onChange={(e) => setForm({ ...form, transport_mode: e.target.value })} /></div>
              <div className="field"><label>रेल्वे/बोटीचे नाव</label><input value={form.vehicle_name} onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })} /></div>
              <div className="field"><label>वर्ग</label><input value={form.travel_class} onChange={(e) => setForm({ ...form, travel_class: e.target.value })} /></div>
              <div className="field"><label>तिकिटांची संख्या</label><input type="number" min="0" value={form.ticket_count} onChange={(e) => setForm({ ...form, ticket_count: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>प्रमाणके (जोडलेली कागदपत्रे)</label><input value={form.enclosures} onChange={(e) => setForm({ ...form, enclosures: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>

              <div className="field"><label>रेल्वे/बस/बोट भाडे</label><input type="number" step="0.01" min="0" value={form.fare_amount} onChange={(e) => setForm({ ...form, fare_amount: e.target.value })} /></div>
              <div className="field"><label>अंतर (कि.मी.)</label><input type="number" step="0.01" min="0" value={form.mileage_km} onChange={(e) => setForm({ ...form, mileage_km: e.target.value })} /></div>
              <div className="field"><label>मैल भत्ता दर (प्रति कि.मी.)</label><input type="number" step="0.01" min="0" value={form.mileage_rate} onChange={(e) => setForm({ ...form, mileage_rate: e.target.value })} /></div>
              <div className="field"><label>दिवसांची संख्या</label><input type="number" step="0.5" min="0" value={form.daily_allowance_days} onChange={(e) => setForm({ ...form, daily_allowance_days: e.target.value })} /></div>
              <div className="field"><label>दैनिक भत्ता दर</label><input type="number" step="0.01" min="0" value={form.daily_allowance_rate} onChange={(e) => setForm({ ...form, daily_allowance_rate: e.target.value })} /></div>

              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>लेखाशीर्ष (खर्च)</label>
                <div className="combo-wrap">
                  <input
                    value={headSearch}
                    onChange={(e) => { setHeadSearch(e.target.value); setSelectedHeadId(''); setHeadDropdownOpen(true); }}
                    onFocus={() => setHeadDropdownOpen(true)}
                    placeholder="कोड किंवा नाव टाइप करा"
                    style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                  {headSearch && (
                    <button type="button" className="combo-clear-btn" onMouseDown={(e) => { e.preventDefault(); setHeadSearch(''); setSelectedHeadId(''); setHeadDropdownOpen(true); }}>×</button>
                  )}
                  {headDropdownOpen && (
                    <div className="combo-dropdown">
                      {headResults.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
                      {headResults.map((h) => <div key={h.id} className="combo-option" onMouseDown={() => selectHead(h)}>{h.code} - {h.name}</div>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            </div>

            <div className="card" style={{ maxWidth: 320, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>मैल भत्ता</span><strong>{mileageAmount.toFixed(2)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>दैनिक भत्ता</span><strong>{dailyAmount.toFixed(2)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                <span>एकूण देय</span><strong>{total.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : 'नोंद करा (रोकड वहीत पोस्ट होईल)'}</button>
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
                <tr><th>नाव</th><th>दिनांक</th><th>कोठून-कोठे</th><th>लेखाशीर्ष</th><th className="num">एकूण</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.traveller_name}</td>
                    <td>{fmtDate(r.travel_date)}</td>
                    <td>{r.from_place || '-'} - {r.to_place || '-'}</td>
                    <td>{r.head_code} - {r.head_name}</td>
                    <td className="num">{Number(r.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canEditBill && rows.length > 0 && (
        <div className="card no-print" style={{ marginTop: 20 }}>
          <form onSubmit={saveDetail}>
            <h2 style={{ fontSize: 15, marginTop: 0 }}>प्रवासाचे तपशील पूर्ण करा (नमुना ३१)</h2>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>कोणते देयक</label>
                <select value={detailId} onChange={(e) => setDetailId(e.target.value)}>
                  {rows.map((r) => <option key={r.id} value={r.id}>{r.traveller_name} - {fmtDate(r.travel_date)}</option>)}
                </select>
              </div>
              <div className="field"><label>कार्यालयाचे ठिकाण</label><input value={detail.office_place} onChange={setD('office_place')} /></div>
              <div className="field"><label>निर्गमन वेळ</label><input value={detail.depart_time} onChange={setD('depart_time')} /></div>
              <div className="field"><label>आगमन दिनांक</label><input type="date" value={detail.arrival_date} onChange={setD('arrival_date')} /></div>
              <div className="field"><label>आगमन वेळ</label><input value={detail.arrival_time} onChange={setD('arrival_time')} /></div>
              <div className="field"><label>प्रवासाचे साधन</label><input value={detail.transport_mode} onChange={setD('transport_mode')} /></div>
              <div className="field"><label>रेल्वे/बोटीचे नाव</label><input value={detail.vehicle_name} onChange={setD('vehicle_name')} /></div>
              <div className="field"><label>वर्ग</label><input value={detail.travel_class} onChange={setD('travel_class')} /></div>
              <div className="field"><label>तिकिटांची संख्या</label><input type="number" min="0" value={detail.ticket_count} onChange={setD('ticket_count')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>प्रमाणके (जोडलेली कागदपत्रे)</label><input value={detail.enclosures} onChange={setD('enclosures')} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={detail.remark} onChange={setD('remark')} /></div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>रकमा (भाडे, मैल/दैनिक भत्ता) बदलत नाहीत; सह्या कागदावर हाताने.</div>
            <div style={{ marginTop: 10 }}><button className="btn secondary" type="submit">तपशील जतन करा</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
