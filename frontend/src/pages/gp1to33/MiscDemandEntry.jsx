import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import HeadCombo from '../../components/HeadCombo';

const fmt = (n) => Number(n || 0).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { party_name: '', address: '', nature: '', authority: '', installment_count: '1', amount: '', demand_no: '', demand_date: today(), remark: '' };
const emptyEvent = { kind: 'वसुली', event_date: today(), amount: '', receipt_no: '', order_no: '' };

// नमुना ११ - किरकोळ मागणी नोंदवही. मागणी नोंदवा; नंतर वसुली/सूट त्या मागणीवरच
// नोंदवा. वसुली आपोआप रोकड वहीत (नमुना ५) जमा म्हणून जाते, शिल्लक आपोआप मोजली जाते.
export default function MiscDemandEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [heads, setHeads] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [headId, setHeadId] = useState('');
  const [openId, setOpenId] = useState(null);
  const [ev, setEv] = useState(emptyEvent);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);
  function load() {
    if (!yearId) return;
    client.get('/misc-demands', { params: { financialYearId: yearId } }).then(({ data }) => setRows(data));
  }
  useEffect(() => { load(); }, [yearId]);

  async function addDemand(e) {
    e.preventDefault();
    setError('');
    if (!headId) { setError('कृपया लेखाशीर्ष (जमा) निवडा'); return; }
    setBusy(true);
    try {
      await client.post('/misc-demands', { ...form, financial_year_id: yearId, ledger_head_id: headId });
      setForm(emptyForm); setHeadId(''); load();
    } catch (err) { setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली'); } finally { setBusy(false); }
  }

  async function addEvent(e, id) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post(`/misc-demands/${id}/events`, ev);
      setEv(emptyEvent); setOpenId(null); load();
    } catch (err) { setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली'); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>किरकोळ मागणी नोंदणी (नमुना ११) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}

      {can('misc_demands', 'add') && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={addDemand}>
            <div className="form-grid">
              <div className="field"><label>ज्याच्याकडून वसूल करायचे त्याचे नाव</label><input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} required /></div>
              <div className="field"><label>पत्ता</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="field"><label>मागणीचे स्वरूप</label><input value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} /></div>
              <div className="field"><label>मागणीसाठी प्राधिकार</label><input value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} /></div>
              <div className="field"><label>हप्त्यांची संख्या</label><input type="number" min="1" value={form.installment_count} onChange={(e) => setForm({ ...form, installment_count: e.target.value })} /></div>
              <div className="field"><label>मागणीची रक्कम</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              <div className="field"><label>देयक क्रमांक</label><input value={form.demand_no} onChange={(e) => setForm({ ...form, demand_no: e.target.value })} /></div>
              <div className="field"><label>देयक दिनांक</label><input type="date" value={form.demand_date} onChange={(e) => setForm({ ...form, demand_date: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>वसुली कोणत्या जमा लेखाशीर्षाखाली</label><HeadCombo heads={heads} groupType="जमा" value={headId} onChange={setHeadId} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit" disabled={busy}>मागणी नोंदवा</button></div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <div className="table-wrap">
          <table>
            <thead><tr><th>नाव</th><th>स्वरूप</th><th>देयक क्र./दि.</th><th className="num">मागणी</th><th className="num">वसूल</th><th className="num">सूट</th><th className="num">शिल्लक</th><th></th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <Fragment key={d.id}>
                  <tr>
                    <td>{d.party_name}</td><td>{d.nature || '-'}</td><td>{d.demand_no || '-'} {d.demand_date || ''}</td>
                    <td className="num">{fmt(d.amount)}</td><td className="num">{fmt(d.recovered_total)}</td><td className="num">{fmt(d.waived_total)}</td><td className="num"><strong>{fmt(d.balance)}</strong></td>
                    <td>{can('misc_demands', 'edit') && d.balance > 0 && <button className="btn secondary small" type="button" onClick={() => { setOpenId(openId === d.id ? null : d.id); setEv(emptyEvent); }}>वसुली/सूट</button>}</td>
                  </tr>
                  {openId === d.id && (
                    <tr><td colSpan={8}>
                      <form onSubmit={(e) => addEvent(e, d.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <select value={ev.kind} onChange={(e) => setEv({ ...ev, kind: e.target.value })}><option value="वसुली">वसुली</option><option value="सूट">सूट</option></select>
                        <input type="date" value={ev.event_date} onChange={(e) => setEv({ ...ev, event_date: e.target.value })} required />
                        <input type="number" step="0.01" min="0" placeholder="रक्कम" value={ev.amount} onChange={(e) => setEv({ ...ev, amount: e.target.value })} required />
                        {ev.kind === 'वसुली'
                          ? <input placeholder="पावती क्र." value={ev.receipt_no} onChange={(e) => setEv({ ...ev, receipt_no: e.target.value })} />
                          : <input placeholder="आदेश क्र. व दिनांक" value={ev.order_no} onChange={(e) => setEv({ ...ev, order_no: e.target.value })} />}
                        <button className="btn small" type="submit" disabled={busy}>{ev.kind === 'वसुली' ? 'नोंदवा (रोकड वहीत जमा)' : 'सूट नोंदवा'}</button>
                      </form>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
