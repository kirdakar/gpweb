import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

const emptyWork = { name: '', sanction_order_no: '', sanction_date: '', sanctioning_authority: '', contractor_id: '', remark: '' };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना २०/२०(क)/२०(ख) - सार्वजनिक बांधकाम. काम -> अंदाज (दरसूचीतून दर) -> मोजमाप
// (दर अंदाजावरून) -> देयक (मोजमाप - आधीची देयके). रक्कम/संख्या कुठेही हाताने
// टाईप करायची नाही; देयक नोंदताच रोकड वहीत (नमुना ५) खर्च पोस्ट होतो.
export default function WorkEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const [heads, setHeads] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [rateItems, setRateItems] = useState([]);
  const [works, setWorks] = useState([]);
  const [workId, setWorkId] = useState('');
  const [work, setWork] = useState(null);
  const [tab, setTab] = useState('estimate');
  // नमुना २०(ख)(१) च्या छापील देयकावरील अधिकारी/क्रमांक/तारखा - निवडलेल्या देयकासाठी (देयक नोंदल्यानंतरही भरता/बदलता येते)
  const emptyDetail = { measurer_name: '', measurer_designation: '', measurer_date: '', measurement_book_no: '', measurement_page_no: '', checking_date: '', preparer_name: '', cheque_no: '', cheque_date: '', receipt_date: '', cash_paid_amount: '' };
  const [detailBillId, setDetailBillId] = useState('');
  const [detail, setDetail] = useState(emptyDetail);
  const setD = (k) => (e) => setDetail({ ...detail, [k]: e.target.value });
  useEffect(() => {
    if (!work || work.bills.length === 0) { setDetailBillId(''); setDetail(emptyDetail); return; }
    if (!work.bills.some((b) => String(b.id) === String(detailBillId))) setDetailBillId(String(work.bills[work.bills.length - 1].id));
  }, [work]);
  useEffect(() => {
    const b = work?.bills.find((x) => String(x.id) === String(detailBillId));
    setDetail(b ? Object.fromEntries(Object.keys(emptyDetail).map((k) => [k, b[k] ?? ''])) : emptyDetail);
  }, [detailBillId, work]);

  // नमुना २०(ख) च्या छापील देयकावरील कंत्राट तपशील (कामावर एकदा भरला की प्रत्येक देयकावर येतो)
  const [contract, setContract] = useState({ supplier_name: '', contract_no: '', contract_date: '', rate_schedule_no: '', rate_schedule_date: '' });
  useEffect(() => {
    if (!work) return;
    setContract({
      supplier_name: work.supplier_name || '', contract_no: work.contract_no || '',
      contract_date: work.contract_date ? String(work.contract_date).slice(0, 10) : '',
      rate_schedule_no: work.rate_schedule_no || '',
      rate_schedule_date: work.rate_schedule_date ? String(work.rate_schedule_date).slice(0, 10) : '',
    });
  }, [work?.id, work?.supplier_name, work?.contract_no, work?.contract_date, work?.rate_schedule_no, work?.rate_schedule_date]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newWork, setNewWork] = useState(emptyWork);
  const [headSearch, setHeadSearch] = useState('');
  const [headOpen, setHeadOpen] = useState(false);
  const [headId, setHeadId] = useState('');

  const [est, setEst] = useState({ rate_item_id: '', description: '', unit: '', quantity: '', rate: '' });
  const [meas, setMeas] = useState({ estimate_item_id: '', measured_on: today(), location_note: '', nos: '', length: '', breadth: '', depth: '' });
  const [bill, setBill] = useState({ bill_no: '', bill_date: today(), contractor_id: '', deduction_amount: '', deduction_note: '' });

  useEffect(() => {
    client.get('/ledger-heads').then(({ data }) => setHeads(data));
    client.get('/contractors', { params: { activeOnly: 1 } }).then(({ data }) => setContractors(data));
    client.get('/rate-schedule', { params: { activeOnly: 1 } }).then(({ data }) => setRateItems(data));
  }, []);

  function loadWorks(selectId) {
    if (!yearId) return;
    client.get('/works', { params: { financialYearId: yearId } }).then(({ data }) => {
      setWorks(data);
      if (selectId) setWorkId(String(selectId));
    });
  }
  useEffect(() => { loadWorks(); setWorkId(''); setWork(null); }, [yearId]);

  useEffect(() => {
    if (!workId) { setWork(null); return; }
    client.get(`/works/${workId}`).then(({ data }) => setWork(data));
  }, [workId]);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === 'खर्च'), [heads]);
  const term = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => (term ? leafHeads.filter((h) => h.name.toLowerCase().includes(term) || h.code.toLowerCase().includes(term)) : leafHeads), [leafHeads, term]);

  async function run(fn, onOk) {
    setError('');
    setBusy(true);
    try {
      const data = await fn();
      if (onOk) onOk(data);
    } catch (err) {
      setError(err.response?.data?.error || 'त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  function createWork(e) {
    e.preventDefault();
    if (!newWork.name.trim()) { setError('कामाचे नाव आवश्यक आहे'); return; }
    if (!headId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    run(() => client.post('/works', { ...newWork, financial_year_id: yearId, ledger_head_id: headId, contractor_id: newWork.contractor_id || null }), ({ data }) => {
      setNewWork(emptyWork); setHeadId(''); setHeadSearch(''); setShowNew(false);
      loadWorks(data.id);
    });
  }

  function pickRateItem(id) {
    const ri = rateItems.find((r) => String(r.id) === String(id));
    if (ri) setEst({ ...est, rate_item_id: id, description: ri.description, unit: ri.unit, rate: String(ri.rate) });
    else setEst({ ...est, rate_item_id: '' });
  }
  function addEstimate(e) {
    e.preventDefault();
    run(() => client.post(`/works/${workId}/estimate`, est), ({ data }) => {
      setWork(data);
      setEst({ rate_item_id: '', description: '', unit: '', quantity: '', rate: '' });
    });
  }
  function delEstimate(id) {
    run(() => client.delete(`/works/${workId}/estimate/${id}`), ({ data }) => setWork(data));
  }
  function addMeasurement(e) {
    e.preventDefault();
    run(() => client.post(`/works/${workId}/measurements`, meas), ({ data }) => {
      setWork(data);
      setMeas({ ...meas, location_note: '', nos: '', length: '', breadth: '', depth: '' });
    });
  }
  function delMeasurement(id) {
    run(() => client.delete(`/works/${workId}/measurements/${id}`), ({ data }) => setWork(data));
  }
  function addBill(e) {
    e.preventDefault();
    run(() => client.post(`/works/${workId}/bills`, bill), ({ data }) => {
      setWork(data);
      setBill({ bill_no: '', bill_date: today(), contractor_id: '', deduction_amount: '', deduction_note: '' });
    });
  }
  function setStatus(status) {
    run(() => client.put(`/works/${workId}`, { ...work, status }), ({ data }) => setWork(data));
  }
  function saveBillDetail(e) {
    e.preventDefault();
    run(() => client.put(`/works/${workId}/bills/${detailBillId}`, detail), ({ data }) => setWork(data));
  }
  function saveContract(e) {
    e.preventDefault();
    run(() => client.put(`/works/${workId}`, { ...work, ...contract }), ({ data }) => setWork(data));
  }
  function deleteWork() {
    if (!window.confirm('हे काम मिटवायचे आहे का?')) return;
    run(() => client.delete(`/works/${workId}`), () => { setWorkId(''); setWork(null); loadWorks(); });
  }

  const s = work?.summary;
  const previewQty = ['nos', 'length', 'breadth', 'depth'].reduce((p, k) => p * (meas[k] === '' ? 1 : Number(meas[k]) || 0), 1);
  const measItem = work?.estimate_items.find((i) => String(i.id) === String(meas.estimate_item_id));
  const previewAmount = measItem ? previewQty * Number(measItem.rate) : 0;
  const pendingBill = s ? Math.round((s.measured_total - s.billed_total) * 100) / 100 : 0;
  const canAdd = can('works', 'add');
  const canEdit = can('works', 'edit');

  return (
    <div className="page data-entry-page">
      <div className="page-header no-print">
        <h1>बांधकाम नोंदणी (नमुना २०/२०क/२०ख) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={workId} onChange={(e) => setWorkId(e.target.value)} style={{ minWidth: 320 }}>
            <option value="">-- काम निवडा --</option>
            {works.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.status})</option>)}
          </select>
          {canAdd && <button className="btn secondary" type="button" onClick={() => setShowNew(!showNew)}>{showNew ? 'रद्द करा' : 'नवीन काम'}</button>}
        </div>

        {showNew && (
          <form onSubmit={createWork} style={{ marginTop: 14 }}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>कामाचे नाव</label><input value={newWork.name} onChange={(e) => setNewWork({ ...newWork, name: e.target.value })} required /></div>
              <div className="field"><label>प्रशासकीय मान्यता क्र.</label><input value={newWork.sanction_order_no} onChange={(e) => setNewWork({ ...newWork, sanction_order_no: e.target.value })} /></div>
              <div className="field"><label>मान्यता दिनांक</label><input type="date" value={newWork.sanction_date} onChange={(e) => setNewWork({ ...newWork, sanction_date: e.target.value })} /></div>
              <div className="field"><label>मान्यता देणारे प्राधिकारी</label><input value={newWork.sanctioning_authority} onChange={(e) => setNewWork({ ...newWork, sanctioning_authority: e.target.value })} /></div>
              <div className="field">
                <label>कंत्राटदार (असल्यास)</label>
                <select value={newWork.contractor_id} onChange={(e) => setNewWork({ ...newWork, contractor_id: e.target.value })}>
                  <option value="">-- नाही --</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>खर्चाचे लेखाशीर्ष</label>
                <div className="combo-wrap">
                  <input
                    value={headSearch}
                    onChange={(e) => { setHeadSearch(e.target.value); setHeadId(''); setHeadOpen(true); }}
                    onFocus={() => setHeadOpen(true)}
                    placeholder="कोड किंवा नाव टाइप करा"
                    style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                  {headOpen && (
                    <div className="combo-dropdown">
                      {headResults.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
                      {headResults.map((h) => (
                        <div key={h.id} className="combo-option" onMouseDown={() => { setHeadId(h.id); setHeadSearch(`${h.code} - ${h.name}`); setHeadOpen(false); }}>{h.code} - {h.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit" disabled={busy}>काम नोंदवा</button></div>
          </form>
        )}
      </div>

      {work && (
        <>
          <div className="card no-print" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{work.name}</strong>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {work.head_code} - {work.head_name}
                  {work.contractor_name ? ` | कंत्राटदार: ${work.contractor_name}` : ''}
                  {work.sanction_order_no ? ` | मान्यता: ${work.sanction_order_no}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {canEdit && <button className="btn secondary small" type="button" onClick={() => setStatus(work.status === 'चालू' ? 'पूर्ण' : 'चालू')}>{work.status === 'चालू' ? 'काम पूर्ण झाले' : 'पुन्हा चालू करा'}</button>}
                {can('works', 'delete') && <button className="btn danger small" type="button" onClick={deleteWork}>काम मिटवा</button>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 10 }}>
              <div>अंदाजित: <strong>{fmt(s.estimate_total)}</strong></div>
              <div>मोजमाप झालेले: <strong>{fmt(s.measured_total)}</strong></div>
              <div>देयके दिलेली: <strong>{fmt(s.billed_total)}</strong></div>
              <div>देय शिल्लक: <strong>{fmt(pendingBill)}</strong></div>
              {s.muster_wages_posted > 0 && <div>हजेरीपट मजुरी: <strong>{fmt(s.muster_wages_posted)}</strong></div>}
            </div>
          </div>

          <div className="search-bar no-print" style={{ gap: 8 }}>
            {[['estimate', 'अंदाज (नमुना २०)'], ['measurement', 'मोजमाप (नमुना २०क)'], ['bill', 'देयक (नमुना २०ख)']].map(([k, l]) => (
              <button key={k} className={`btn ${tab === k ? '' : 'secondary'}`} type="button" onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {tab === 'estimate' && (
            <div className="card no-print">
              {canEdit && (
                <form onSubmit={addEstimate} style={{ marginBottom: 14 }}>
                  <div className="form-grid">
                    <div className="field" style={{ gridColumn: 'span 2' }}>
                      <label>दरसूचीतून निवडा</label>
                      <select value={est.rate_item_id} onChange={(e) => pickRateItem(e.target.value)}>
                        <option value="">-- हाताने भरा / निवडा --</option>
                        {rateItems.map((r) => <option key={r.id} value={r.id}>{r.description} ({r.unit} @ {fmt(r.rate)})</option>)}
                      </select>
                    </div>
                    <div className="field" style={{ gridColumn: 'span 2' }}><label>तपशील</label><input value={est.description} onChange={(e) => setEst({ ...est, description: e.target.value })} required /></div>
                    <div className="field"><label>एकक</label><input value={est.unit} onChange={(e) => setEst({ ...est, unit: e.target.value })} required /></div>
                    <div className="field"><label>परिमाण</label><input type="number" step="0.001" min="0" value={est.quantity} onChange={(e) => setEst({ ...est, quantity: e.target.value })} required /></div>
                    <div className="field"><label>दर</label><input type="number" step="0.01" min="0" value={est.rate} onChange={(e) => setEst({ ...est, rate: e.target.value })} required /></div>
                    <div className="field"><label>रक्कम</label><input readOnly value={fmt((Number(est.quantity) || 0) * (Number(est.rate) || 0))} /></div>
                  </div>
                  <div style={{ marginTop: 10 }}><button className="btn" type="submit" disabled={busy}>ओळ जोडा</button></div>
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>अ.क्र.</th><th>तपशील</th><th>एकक</th><th className="num">परिमाण</th><th className="num">दर</th><th className="num">रक्कम</th><th></th></tr></thead>
                  <tbody>
                    {work.estimate_items.map((i, n) => (
                      <tr key={i.id}>
                        <td>{n + 1}</td><td>{i.description}</td><td>{i.unit}</td>
                        <td className="num">{Number(i.quantity)}</td><td className="num">{fmt(i.rate)}</td><td className="num">{fmt(i.amount)}</td>
                        <td>{canEdit && <button className="btn danger small" type="button" onClick={() => delEstimate(i.id)}>मिटवा</button>}</td>
                      </tr>
                    ))}
                    {work.estimate_items.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अंदाज ओळी नाहीत</td></tr>}
                    {work.estimate_items.length > 0 && <tr><td colSpan={5} style={{ textAlign: 'right' }}><strong>एकूण अंदाज</strong></td><td className="num"><strong>{fmt(s.estimate_total)}</strong></td><td /></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'measurement' && (
            <div className="card no-print">
              {canEdit && (
                <form onSubmit={addMeasurement} style={{ marginBottom: 14 }}>
                  <div className="form-grid">
                    <div className="field" style={{ gridColumn: 'span 2' }}>
                      <label>अंदाज ओळ</label>
                      <select value={meas.estimate_item_id} onChange={(e) => setMeas({ ...meas, estimate_item_id: e.target.value })} required>
                        <option value="">-- निवडा --</option>
                        {work.estimate_items.map((i) => <option key={i.id} value={i.id}>{i.description} ({i.unit} @ {fmt(i.rate)})</option>)}
                      </select>
                    </div>
                    <div className="field"><label>मोजमाप दिनांक</label><input type="date" value={meas.measured_on} onChange={(e) => setMeas({ ...meas, measured_on: e.target.value })} required /></div>
                    <div className="field"><label>ठिकाण/शेरा</label><input value={meas.location_note} onChange={(e) => setMeas({ ...meas, location_note: e.target.value })} /></div>
                    <div className="field"><label>नग</label><input type="number" step="0.001" min="0" value={meas.nos} onChange={(e) => setMeas({ ...meas, nos: e.target.value })} placeholder="1" /></div>
                    <div className="field"><label>लांबी</label><input type="number" step="0.001" min="0" value={meas.length} onChange={(e) => setMeas({ ...meas, length: e.target.value })} placeholder="1" /></div>
                    <div className="field"><label>रुंदी</label><input type="number" step="0.001" min="0" value={meas.breadth} onChange={(e) => setMeas({ ...meas, breadth: e.target.value })} placeholder="1" /></div>
                    <div className="field"><label>खोली/उंची</label><input type="number" step="0.001" min="0" value={meas.depth} onChange={(e) => setMeas({ ...meas, depth: e.target.value })} placeholder="1" /></div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span>परिमाण: <strong>{previewQty.toFixed(3)}</strong> | रक्कम: <strong>{fmt(previewAmount)}</strong></span>
                    <button className="btn" type="submit" disabled={busy}>मोजमाप नोंदवा</button>
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.7, margin: '6px 0 0' }}>रिकामे मोजमाप 1 मानले जाते (उदा. फक्त नग असलेल्या कामासाठी लांबी/रुंदी/खोली रिकामी ठेवा).</p>
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>दिनांक</th><th>तपशील</th><th>ठिकाण</th><th className="num">नग</th><th className="num">लां.</th><th className="num">रुं.</th><th className="num">खो.</th><th className="num">परिमाण</th><th className="num">दर</th><th className="num">रक्कम</th><th></th></tr></thead>
                  <tbody>
                    {work.measurements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.measured_on}</td><td>{m.description} ({m.unit})</td><td>{m.location_note || '-'}</td>
                        <td className="num">{Number(m.nos)}</td><td className="num">{Number(m.length)}</td><td className="num">{Number(m.breadth)}</td><td className="num">{Number(m.depth)}</td>
                        <td className="num">{m.quantity.toFixed(3)}</td><td className="num">{fmt(m.rate)}</td><td className="num">{fmt(m.amount)}</td>
                        <td>{canEdit && work.bills.length === 0 && <button className="btn danger small" type="button" onClick={() => delMeasurement(m.id)}>मिटवा</button>}</td>
                      </tr>
                    ))}
                    {work.measurements.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center' }}>मोजमाप नाही</td></tr>}
                    {work.measurements.length > 0 && <tr><td colSpan={9} style={{ textAlign: 'right' }}><strong>एकूण मोजमाप रक्कम</strong></td><td className="num"><strong>{fmt(s.measured_total)}</strong></td><td /></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'bill' && (
            <div className="card no-print">
              {canEdit && (
                <form onSubmit={saveContract} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>देयकावरील कंत्राट तपशील (नमुना २०ख)</h3>
                  <div className="form-grid">
                    <div className="field"><label>पुरवठाकार</label><input value={contract.supplier_name} onChange={(e) => setContract({ ...contract, supplier_name: e.target.value })} /></div>
                    <div className="field"><label>कंत्राट क्रमांक</label><input value={contract.contract_no} onChange={(e) => setContract({ ...contract, contract_no: e.target.value })} /></div>
                    <div className="field"><label>कंत्राट दिनांक</label><input type="date" value={contract.contract_date} onChange={(e) => setContract({ ...contract, contract_date: e.target.value })} /></div>
                    <div className="field"><label>दरसूची क्रमांक</label><input value={contract.rate_schedule_no} onChange={(e) => setContract({ ...contract, rate_schedule_no: e.target.value })} /></div>
                    <div className="field"><label>दरसूची दिनांक</label><input type="date" value={contract.rate_schedule_date} onChange={(e) => setContract({ ...contract, rate_schedule_date: e.target.value })} /></div>
                  </div>
                  <div style={{ marginTop: 10 }}><button className="btn secondary" type="submit" disabled={busy}>कंत्राट तपशील जतन करा</button></div>
                </form>
              )}
              {canAdd && (
                <form onSubmit={addBill} style={{ marginBottom: 14 }}>
                  <div className="form-grid">
                    <div className="field"><label>देयक क्र.</label><input value={bill.bill_no} onChange={(e) => setBill({ ...bill, bill_no: e.target.value })} /></div>
                    <div className="field"><label>देयक दिनांक</label><input type="date" value={bill.bill_date} onChange={(e) => setBill({ ...bill, bill_date: e.target.value })} required /></div>
                    <div className="field">
                      <label>कंत्राटदार</label>
                      <select value={bill.contractor_id} onChange={(e) => setBill({ ...bill, contractor_id: e.target.value })}>
                        <option value="">{work.contractor_name ? `${work.contractor_name} (कामावरील)` : '-- नाही --'}</option>
                        {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>कपात (सुरक्षा अनामत/कर)</label><input type="number" step="0.01" min="0" value={bill.deduction_amount} onChange={(e) => setBill({ ...bill, deduction_amount: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 2' }}><label>कपातीचा तपशील</label><input value={bill.deduction_note} onChange={(e) => setBill({ ...bill, deduction_note: e.target.value })} /></div>
                  </div>
                  <div className="card" style={{ maxWidth: 360, marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>आजपर्यंतचे मोजमाप</span><strong>{fmt(s.measured_total)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>आधीची देयके</span><strong>{fmt(s.billed_total)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>या देयकाची रक्कम</span><strong>{fmt(pendingBill)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                      <span>निव्वळ देय</span><strong>{fmt(pendingBill - (Number(bill.deduction_amount) || 0))}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}><button className="btn" type="submit" disabled={busy || pendingBill <= 0}>देयक नोंदवा (रोकड वहीत पोस्ट होईल)</button></div>
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>क्र.</th><th>दिनांक</th><th>कंत्राटदार</th><th className="num">आजपर्यंतचे मोजमाप</th><th className="num">आधीची देयके</th><th className="num">या देयकाची रक्कम</th><th className="num">कपात</th><th className="num">निव्वळ देय</th></tr></thead>
                  <tbody>
                    {work.bills.map((b) => (
                      <tr key={b.id}>
                        <td>{b.bill_no || b.id}</td><td>{fmtDate(b.bill_date)}</td><td>{b.contractor_name || '-'}</td>
                        <td className="num">{fmt(b.gross_to_date)}</td><td className="num">{fmt(b.previous_bills_total)}</td>
                        <td className="num">{fmt(b.this_bill_amount)}</td><td className="num">{fmt(b.deduction_amount)}</td><td className="num">{fmt(b.net_payable)}</td>
                      </tr>
                    ))}
                    {work.bills.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>देयके नाहीत</td></tr>}
                  </tbody>
                </table>
              </div>

              {canEdit && work.bills.length > 0 && (
                <form onSubmit={saveBillDetail} style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>देयकाची आतील बाजू - अधिकारी/सही तपशील (नमुना २०ख(१))</h3>
                  <div className="form-grid">
                    <div className="field">
                      <label>कोणते देयक</label>
                      <select value={detailBillId} onChange={(e) => setDetailBillId(e.target.value)}>
                        {work.bills.map((b) => <option key={b.id} value={b.id}>{b.bill_no || b.id} - {fmtDate(b.bill_date)}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>मोजमाप नोंदविणाऱ्या अधिकाऱ्याचे नाव</label><input value={detail.measurer_name} onChange={setD('measurer_name')} /></div>
                    <div className="field"><label>पदनाम</label><input value={detail.measurer_designation} onChange={setD('measurer_designation')} /></div>
                    <div className="field"><label>मोजमाप नोंदविल्याचा दिनांक</label><input type="date" value={detail.measurer_date} onChange={setD('measurer_date')} /></div>
                    <div className="field"><label>मोजमाप वही क्रमांक</label><input value={detail.measurement_book_no} onChange={setD('measurement_book_no')} /></div>
                    <div className="field"><label>पृष्ठ क्र.</label><input value={detail.measurement_page_no} onChange={setD('measurement_page_no')} /></div>
                    <div className="field"><label>तपासणीचा दिनांक</label><input type="date" value={detail.checking_date} onChange={setD('checking_date')} /></div>
                    <div className="field"><label>देयक तयार करणाऱ्या अधिकाऱ्याचे नाव</label><input value={detail.preparer_name} onChange={setD('preparer_name')} /></div>
                    <div className="field"><label>धनादेश क्रमांक</label><input value={detail.cheque_no} onChange={setD('cheque_no')} /></div>
                    <div className="field"><label>धनादेश दिनांक</label><input type="date" value={detail.cheque_date} onChange={setD('cheque_date')} /></div>
                    <div className="field"><label>पैसे घेतल्याचा दिनांक</label><input type="date" value={detail.receipt_date} onChange={setD('receipt_date')} /></div>
                    <div className="field"><label>रोख दिलेली रक्कम (रु.)</label><input type="number" step="0.01" min="0" value={detail.cash_paid_amount} onChange={setD('cash_paid_amount')} /></div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>सह्या, मुद्रांक व आदात्याची सही कागदावर हाताने; देय/प्रदान रक्कम देयकावरून आपोआप छापली जाते.</div>
                  <div style={{ marginTop: 10 }}><button className="btn secondary" type="submit" disabled={busy || !detailBillId}>तपशील जतन करा</button></div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
