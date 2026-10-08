import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const qty = (n) => String(Number(Number(n || 0).toFixed(3)));
const dots = (n) => '.'.repeat(n);
// भरलेले मूल्य ठळक, नसेल तर ठिपक्यांची रेघ (हाताने लिहायला)
const v = (val, n) => (val ? <strong>{val}</strong> : dots(n));
const vd = (val, n) => (val ? <strong>{fmtDate(val)}</strong> : dots(n));

const VIEWS = {
  estimate: { screen: 'reports_work_estimate', title: 'कामाच्या अंदाजाची नोंदवही (नमुना २०)' },
  measurement: { screen: 'reports_work_measurement', title: 'मोजमाप वही (नमुना २०क)' },
  bills: { screen: 'reports_work_bills', title: 'कामाचे देयक (नमुना २०ख)' },
  billdetail: { screen: 'reports_work_bills', title: 'कामाचे देयक - आतील बाजू (नमुना २०ख(१))' },
};

// नमुना २०, २०(क), २०(ख) चे कागदी नमुन्याप्रमाणे प्रिंट अहवाल - एकाच डेटावरून (works API), डाटाएंट्री WorkEntry.jsx वर.
// `view` prop ने कोणता नमुना ते ठरते: नमुना २० (उभा A4: बाहेरील बाजू गोषवारा + आतील बाजू मोजमाप अंदाजपत्रक),
// नमुना २०(क) (आडवा A4, १२ रकान्यांची मोजमाप वही), नमुना २०(ख) (उभा A4, प्रत्येक देयकासाठी एक पान).
export default function WorkReport({ view }) {
  const cfg = VIEWS[view];
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [works, setWorks] = useState([]);
  const [workId, setWorkId] = useState('');
  const [work, setWork] = useState(null);

  useEffect(() => {
    if (!yearId) return;
    setWorkId(''); setWork(null);
    client.get('/works', { params: { financialYearId: yearId } }).then(({ data }) => setWorks(data));
  }, [yearId]);
  useEffect(() => {
    if (!workId) { setWork(null); return; }
    client.get(`/works/${workId}`).then(({ data }) => setWork(data));
  }, [workId]);

  // नमुना २०(क): प्रत्येक मोजमापासाठी त्याच बाबीचे आधीचे एकूण परिमाण (९), एकूण (७+९) व आजपर्यंतची रक्कम (१२)
  const measureRows = useMemo(() => {
    if (!work) return [];
    const sorted = [...work.measurements].sort((a, b) => (String(a.measured_on) < String(b.measured_on) ? -1 : String(a.measured_on) > String(b.measured_on) ? 1 : a.id - b.id));
    const running = {};
    return sorted.map((m, i) => {
      const prev = running[m.estimate_item_id] || 0;
      const total = prev + Number(m.quantity);
      running[m.estimate_item_id] = total;
      return { ...m, n: i + 1, prev, total, upto: total * Number(m.rate) };
    });
  }, [work]);

  // नमुना २०(ख)(१): प्रत्येक देयकात समाविष्ट बाबी - मोजमापे (तारीख, क्रमाने) चढत्या रकमेने मांडून, ज्यांची रक्कम
  // "आधीच्या देयकांची रक्कम" ते "आजपर्यंतचे मोजमाप" या टप्प्यात येते तीच या देयकाची; बाबीनुसार परिमाण/रक्कम एकत्र.
  const billItems = useMemo(() => {
    if (!work) return {};
    const sorted = [...work.measurements].sort((a, b) => (String(a.measured_on) < String(b.measured_on) ? -1 : String(a.measured_on) > String(b.measured_on) ? 1 : a.id - b.id));
    const withCum = [];
    let cum = 0;
    for (const m of sorted) { const before = cum; cum += Number(m.amount); withCum.push({ ...m, before, after: cum }); }
    const out = {};
    for (const b of work.bills) {
      const lo = Number(b.previous_bills_total) - 0.005;
      const hi = Number(b.gross_to_date) + 0.005;
      const byItem = new Map();
      for (const m of withCum) {
        if (m.before >= lo && m.after <= hi) {
          const cur = byItem.get(m.estimate_item_id) || { description: m.description, unit: m.unit, rate: Number(m.rate), quantity: 0, amount: 0 };
          cur.quantity += Number(m.quantity); cur.amount += Number(m.amount);
          byItem.set(m.estimate_item_id, cur);
        }
      }
      out[b.id] = [...byItem.values()];
    }
    return out;
  }, [work]);

  const s = work?.summary;
  const sanction = work && work.sanction_order_no
    ? `${work.sanction_order_no}${work.sanction_date ? ` दि. ${fmtDate(work.sanction_date)}` : ''}`
    : '';

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>{cfg.title} {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!work || !can(cfg.screen, 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={workId} onChange={(e) => setWorkId(e.target.value)} style={{ minWidth: 340 }}>
            <option value="">-- काम निवडा --</option>
            {works.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {work && view === 'estimate' && (
        <div className="work-form">
          {/* पान १ - बाहेरील बाजू */}
          <div className="wf-sheet">
            <div className="wf-center wf-h1">नमुना २०</div>
            <div className="wf-center">(नियम २४(२)(ग), (५) व ५१(२) पाहा)</div>
            <div className="wf-center wf-h2">कामाच्या अंदाजाची नोंदवही</div>
            <div className="wf-line">ग्रामपंचायत <strong>{gpName || dots(20)}</strong></div>
            <div className="wf-center" style={{ margin: '10px 0' }}>(बाहेरील बाजू)</div>
            <div style={{ textAlign: 'right' }}>२०{dots(8)} चा {dots(11)} दिनांक</div>
            <div className="wf-line">क्रमांक {dots(22)}</div>
            <div className="wf-line">निधीचे शीर्ष <strong>{work.head_code} {work.head_name}</strong></div>
            <div className="wf-line">उप शीर्ष {dots(18)}</div>
            <div className="wf-line"><strong>{work.name}</strong> मध्ये होण्याचा संभव असलेल्या खर्चाचा {dots(20)} यांनी केलेला अंदाज</div>
            <div className="wf-line" style={{ marginTop: 18 }}>
              (मागणी किंवा प्राधिकार{sanction ? `: ${sanction}` : ''})<br />
              {work.sanctioning_authority ? <strong>{work.sanctioning_authority}</strong> : 'ग्रामपंचायत/पंचायत समिती/जिल्हा परिषद'}<br />
              यांनी मंजूर केलेले
            </div>
            <div className="wf-center wf-h2" style={{ marginTop: 18 }}>सर्वसाधारण वर्णन</div>
            <div className="wf-center wf-h2">गोषवारा</div>
            <table className="wf-table">
              <colgroup><col style={{ width: '17%' }} /><col style={{ width: '31%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '14%' }} /><col style={{ width: '19%' }} /></colgroup>
              <thead>
                <tr><th rowSpan={2}>परिमाण</th><th rowSpan={2}>बाब</th><th colSpan={2}>दर</th><th rowSpan={2}>प्रत्येकी</th><th rowSpan={2}>रक्कम रु. (दशांशात)</th></tr>
                <tr><th>रु.</th><th>पै.</th></tr>
                <tr className="wf-numrow">{[1, 2, 3, 4, 5, 6].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
              </thead>
              <tbody>
                {work.estimate_items.map((i) => {
                  const rate = Number(i.rate);
                  const rupees = Math.floor(rate);
                  const paise = Math.round((rate - rupees) * 100);
                  return (
                    <tr key={i.id}>
                      <td className="num">{qty(i.quantity)}</td><td>{i.description}</td>
                      <td className="num">{rupees}</td><td className="num">{String(paise).padStart(2, '0')}</td>
                      <td>{i.unit}</td><td className="num">{fmt(i.amount)}</td>
                    </tr>
                  );
                })}
                {work.estimate_items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>बाबी नाहीत</td></tr>}
                <tr className="wf-total"><td colSpan={5} style={{ textAlign: 'right' }}>एकूण अंदाजित रक्कम</td><td className="num">{fmt(s.estimate_total)}</td></tr>
              </tbody>
            </table>
            <div className="wf-sign"><span>सचिव<br />दिनांक २०{dots(5)}</span><span>सरपंच</span></div>
          </div>

          {/* पान २ - आतील बाजू */}
          <div className="wf-sheet">
            <div className="wf-center">(आतील बाजू)</div>
            <div className="wf-center">(मोजमाप अंदाजपत्रक)</div>
            <div className="wf-center wf-h2">मोजमाप</div>
            <table className="wf-table">
              <colgroup><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /></colgroup>
              <thead><tr><th>क्रमांक</th><th>लांबी</th><th>रुंदी</th><th>खोली</th><th>परिमाण दशांशात</th><th>एकूण</th></tr></thead>
              <tbody>
                {work.estimate_items.map((i, n) => (
                  <tr key={i.id} style={{ height: 34 }}>
                    <td className="num">{mnum(n + 1)}</td><td /><td /><td />
                    <td className="num">{qty(i.quantity)} {i.unit}</td><td className="num">{qty(i.quantity)}</td>
                  </tr>
                ))}
                {work.estimate_items.length === 0 && <tr style={{ height: 34 }}><td colSpan={6} /></tr>}
              </tbody>
            </table>
            <div className="cb-note" style={{ marginTop: 6 }}>लांबी/रुंदी/खोली अंदाजाच्या बाबींमध्ये साठवली जात नाही - हवी असल्यास हाताने लिहावी; परिमाण अंदाजातील परिमाणावरून आलेले आहे.</div>
          </div>
        </div>
      )}

      {work && view === 'measurement' && (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २०(क)</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम ५१(१) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0 8px' }}>मोजमाप वही</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div>कामाचे प्रत्यक्ष मोजमाप : <strong>{work.name}</strong></div>
            <div>काम करणाऱ्या एजन्सी/अधिकरणाचे नाव : <strong>{work.contractor_name || dots(30)}</strong></div>
            <div>कामाचे वर्णन : <strong>{work.name}</strong></div>
          </div>
          <div className="cb-scroll">
            <table className="cb-table" style={{ marginTop: 8 }}>
              <colgroup>{[6, 22, 6, 6, 6, 8, 7, 8, 9, 9, 7, 9].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>मोजमाप क्रमांक</th>
                  <th rowSpan={2}>कामाचे वर्णन (शक्य असल्यास, कामाचे उप शीर्ष व क्षेत्राचे नाव लिहावे.)</th>
                  <th colSpan={5}>मोजमापाचा तपशील</th>
                  <th rowSpan={2}>एकूण परिमाण/माप (पूर्वीचे हजेरीपत्रकाप्रमाणे वर्णन करावे)</th>
                  <th rowSpan={2}>पूर्वीचे एकूण परिमाण</th>
                  <th rowSpan={2}>एकूण (७+९)</th>
                  <th rowSpan={2}>दर</th>
                  <th rowSpan={2}>रक्कम</th>
                </tr>
                <tr><th>परिमाण</th><th>लांबी</th><th>रुंदी</th><th>खोली/ उंची</th><th>एकूण</th></tr>
                <tr className="cb-numrow">{Array.from({ length: 12 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {measureRows.length === 0 && <tr><td colSpan={12} style={{ textAlign: 'center', padding: 14 }}>मोजमाप नाही</td></tr>}
                {measureRows.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{mnum(m.n)}</td>
                    <td>{m.description}{m.location_note ? ` - ${m.location_note}` : ''} ({fmtDate(m.measured_on)})</td>
                    <td className="num">{qty(m.nos)}</td><td className="num">{qty(m.length)}</td><td className="num">{qty(m.breadth)}</td><td className="num">{qty(m.depth)}</td>
                    <td className="num">{qty(m.quantity)}</td>
                    <td>{m.unit}</td>
                    <td className="num">{m.prev ? qty(m.prev) : ''}</td>
                    <td className="num">{qty(m.total)}</td>
                    <td className="num">{fmt(m.rate)}</td>
                    <td className="num">{fmt(m.upto)}</td>
                  </tr>
                ))}
              </tbody>
              {measureRows.length > 0 && (
                <tfoot>
                  <tr className="cb-total">
                    <td colSpan={11} style={{ textAlign: 'right' }}>आजपर्यंतची एकूण रक्कम (सर्व बाबी)</td>
                    <td className="num">{fmt(s.measured_total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="cb-note">
            <div>टीप.- (१) जेव्हा काम परिमाणामध्ये मोजण्यात येईल तेव्हा स्तंभ (३) व (९) भरण्यात यावेत.</div>
            <div>(२) स्तंभ (१२) अनुसार, मोजमापावरून मंडळाला दिलेली रक्कम वजा केल्यानंतर, शिल्लक निव्वळ रक्कम प्रदान करावी.</div>
          </div>
        </div>
      )}

      {work && view === 'billdetail' && (
        <div>
          {work.bills.length === 0 && <p>या कामाची देयके नाहीत.</p>}
          {work.bills.map((b) => {
            const items = billItems[b.id] || [];
            const itemsTotal = items.reduce((t, i) => t + i.amount, 0);
            return (
              <div key={b.id} className="a4-page cl-page">
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २०(ख)(१)</div>
                <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २४ (२) (ग) (५) व ६१(ग) पाहा)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>कामाचे देयक</span>
                  <span style={{ fontSize: 12 }}>(आतील बाजू)</span>
                </div>
                <div style={{ fontSize: 12, margin: '2px 0 6px' }}>
                  काम: <strong>{work.name}</strong> &nbsp;|&nbsp; देयक क्र. <strong>{b.bill_no || b.id}</strong> &nbsp;|&nbsp; दिनांक <strong>{fmtDate(b.bill_date)}</strong>
                </div>
                <table className="cl-table">
                  <colgroup><col style={{ width: '10%' }} /><col style={{ width: '38%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /></colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2}>परिमाण</th>
                      <th rowSpan={2}>कामाच्या बाबी किंवा सामग्रीचा पुरवठा (अर्थसंकल्पाच्या उप शीर्षाखालील सूचीनुसार)</th>
                      <th colSpan={2}>दर</th>
                      <th rowSpan={2}>परिमाण</th>
                      <th rowSpan={2}>रक्कम</th>
                      <th rowSpan={2}>शेरा</th>
                    </tr>
                    <tr><th>रुपये</th><th>पैसे</th></tr>
                    <tr className="cl-numrow">{[1, 2, 3, 4, 5, 6, 7].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
                  </thead>
                  <tbody>
                    {items.map((i, n) => {
                      const rupees = Math.floor(i.rate);
                      const paise = Math.round((i.rate - rupees) * 100);
                      return (
                        <tr key={n}>
                          <td className="num">{qty(i.quantity)}</td><td className="cl-name">{i.description}</td>
                          <td className="num">{rupees}</td><td className="num">{String(paise).padStart(2, '0')}</td>
                          <td>{i.unit}</td><td className="num">{fmt(i.amount)}</td><td />
                        </tr>
                      );
                    })}
                    {items.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>या देयकासाठी बाबी जुळवता आल्या नाहीत (रक्कम: {fmt(b.this_bill_amount)})</td></tr>}
                    <tr style={{ fontWeight: 700 }}><td colSpan={5} style={{ textAlign: 'right' }}>एकूण रक्कम</td><td className="num">{fmt(items.length ? itemsTotal : b.this_bill_amount)}</td><td /></tr>
                    <tr><td colSpan={5} style={{ textAlign: 'right' }}>वजा: कपात{b.deduction_note ? ` (${b.deduction_note})` : ''}</td><td className="num">{fmt(b.deduction_amount)}</td><td /></tr>
                    <tr style={{ fontWeight: 800 }}><td colSpan={5} style={{ textAlign: 'right' }}>निव्वळ देय रक्कम</td><td className="num">{fmt(b.net_payable)}</td><td /></tr>
                  </tbody>
                </table>

                <div className="wf-box">
                  <div>
                    <div>मोजमाप नोंदविणाऱ्या अधिकाऱ्याचे नाव :- {v(b.measurer_name, 24)}</div>
                    <div>पदनाम : {v(b.measurer_designation, 18)} दिनांक {vd(b.measurer_date, 10)}</div>
                    <div>मोजमाप वही क्रमांक {v(b.measurement_book_no, 10)} पृष्ठ क्र. {v(b.measurement_page_no, 8)}</div>
                    <div style={{ textAlign: 'center' }}>तपासणी अधिकाऱ्याची सही</div>
                    <div>दिनांक : {vd(b.checking_date, 14)}</div>
                    <div>देयक तयार करणाऱ्या अधिकाऱ्याचे नाव : {v(b.preparer_name, 18)}</div>
                    <div>रोखीने/धनादेशाद्वारे देय रक्कम : <strong>{fmt(b.net_payable)}</strong></div>
                    <div style={{ textAlign: 'center' }}>मंजुरी अधिकाऱ्याची सही</div>
                    <div className="wf-split"><span>प्रदान रक्कम <strong>{fmt(b.net_payable)}</strong></span><span>सरपंच/सचिव</span></div>
                  </div>
                  <div>
                    <div>कामासाठी देय असलेली रु. <strong>{fmt(b.net_payable)}</strong> इतकी रक्कम मिळाली.</div>
                    <div style={{ marginTop: 14 }} className="wf-split"><span>पैसे घेणाऱ्याची सही</span><span>मुद्रांक</span><span>दिनांक {b.receipt_date ? <strong>{fmtDate(b.receipt_date)}</strong> : ''}</span></div>
                    <div style={{ marginTop: 14 }} className="wf-split"><span>धनादेश क्रमांक {v(b.cheque_no, 20)}</span><span>दिनांक {b.cheque_date ? <strong>{fmtDate(b.cheque_date)}</strong> : ''}</span></div>
                    <div style={{ marginTop: 14 }}>रोख {b.cash_paid_amount != null ? <strong>{fmt(b.cash_paid_amount)}</strong> : dots(14)} रुपये मी दिले.</div>
                    <div className="wf-split" style={{ marginTop: 28 }}><span /><span>आदात्याची सही व दिनांक</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {work && view === 'bills' && (
        <div className="work-form">
          {work.bills.length === 0 && <p>या कामाची देयके नाहीत.</p>}
          {work.bills.map((b) => (
            <div key={b.id} className="wf-sheet">
              <div className="wf-center wf-h1">नमुना २०(ख)</div>
              <div className="wf-center">(नियम २४(२)(ग)(५) व ६१(ग) पाहा)</div>
              <div className="wf-center wf-h2">कामाचे देयक</div>
              <div className="wf-line" style={{ marginTop: 14 }}>ग्रामपंचायत <strong>{gpName || dots(22)}</strong></div>
              <div className="wf-line"><strong>{work.name}</strong> या कामाचे देयक</div>
              <div className="wf-line wf-split" style={{ marginTop: 14 }}><span>प्रमाणक क्रमांक <strong>{b.bill_no || b.id}</strong></span><span>दिनांक <strong>{fmtDate(b.bill_date)}</strong></span></div>
              <div className="wf-line">कामाचे वर्णन <strong>{work.name}</strong></div>
              <div className="wf-line">कंत्राटदाराचे नाव <strong>{b.contractor_name || work.contractor_name || dots(30)}</strong></div>
              <div className="wf-line">कंत्राटदार {dots(34)}</div>
              <div className="wf-line">पुरवठाकार {work.supplier_name ? <strong>{work.supplier_name}</strong> : dots(34)}</div>
              <div className="wf-line wf-split"><span>कंत्राट क्रमांक {work.contract_no ? <strong>{work.contract_no}</strong> : dots(26)}</span><span>दिनांक {work.contract_date ? <strong>{fmtDate(work.contract_date)}</strong> : dots(14)}</span></div>
              <div className="wf-line wf-split"><span>दरसूची क्रमांक {work.rate_schedule_no ? <strong>{work.rate_schedule_no}</strong> : dots(26)}</span><span>दिनांक {work.rate_schedule_date ? <strong>{fmtDate(work.rate_schedule_date)}</strong> : dots(8)}</span></div>

              <table className="wf-table" style={{ marginTop: 22, maxWidth: 520 }}>
                <tbody>
                  <tr><td>आजपर्यंतचे एकूण मोजमाप (रु.)</td><td className="num">{fmt(b.gross_to_date)}</td></tr>
                  <tr><td>वजा: आधीच्या देयकांची रक्कम</td><td className="num">{fmt(b.previous_bills_total)}</td></tr>
                  <tr><td>या देयकाची रक्कम</td><td className="num">{fmt(b.this_bill_amount)}</td></tr>
                  <tr><td>वजा: कपात{b.deduction_note ? ` (${b.deduction_note})` : ''}</td><td className="num">{fmt(b.deduction_amount)}</td></tr>
                  <tr className="wf-total"><td>निव्वळ देय रक्कम (रु.)</td><td className="num">{fmt(b.net_payable)}</td></tr>
                </tbody>
              </table>
              <div className="wf-line" style={{ marginTop: 8 }}>अक्षरी रुपये <strong>{amountToMarathiWords(b.net_payable)}</strong></div>
              <div className="wf-sign" style={{ marginTop: 70 }}><span>सचिव</span><span>सरपंच</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
