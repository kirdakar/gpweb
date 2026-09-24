import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';
import { fmtDate } from '../../utils/formatDate';

const fmt = (n) => Number(n || 0).toFixed(2);

const VIEWS = {
  estimate: { screen: 'reports_work_estimate', title: 'कामाच्या अंदाजाची नोंदवही (नमुना २०)' },
  measurement: { screen: 'reports_work_measurement', title: 'मोजमाप वही (नमुना २०क)' },
  bills: { screen: 'reports_work_bills', title: 'कामाचे देयक (नमुना २०ख)' },
};

// नमुना २०, २०(क), २०(ख) चे प्रिंट अहवाल - एकाच डेटावरून (works API), डाटाएंट्री
// WorkEntry.jsx (दैनिक व्यवहार) वर. `view` prop ने कोणता नमुना ते ठरते.
export default function WorkReport({ view }) {
  const cfg = VIEWS[view];
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
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

  const s = work?.summary;

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

      {work && (
        <>
          <div className="print-header">
            <h2>{gpLine}</h2>
            <p style={{ fontWeight: 700 }}>{cfg.title}</p>
            <p>कामाचे नाव: {work.name}</p>
            <p>
              लेखाशीर्ष: {work.head_code} - {work.head_name}
              {work.sanction_order_no ? ` | प्रशासकीय मान्यता क्र. ${work.sanction_order_no}${work.sanction_date ? ` दि. ${fmtDate(work.sanction_date)}` : ''}` : ''}
              {work.sanctioning_authority ? ` (${work.sanctioning_authority})` : ''}
            </p>
            {work.contractor_name && <p>कंत्राटदार: {work.contractor_name}</p>}
          </div>

          {view === 'estimate' && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>अ.क्र.</th><th>कामाचा तपशील</th><th>एकक</th><th className="num">परिमाण</th><th className="num">दर (रु.)</th><th className="num">रक्कम (रु.)</th></tr></thead>
                <tbody>
                  {work.estimate_items.map((i, n) => (
                    <tr key={i.id}><td>{n + 1}</td><td>{i.description}</td><td>{i.unit}</td><td className="num">{Number(i.quantity)}</td><td className="num">{fmt(i.rate)}</td><td className="num">{fmt(i.amount)}</td></tr>
                  ))}
                  <tr><td colSpan={5} style={{ textAlign: 'right' }}><strong>एकूण अंदाजित रक्कम</strong></td><td className="num"><strong>{fmt(s.estimate_total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          )}

          {view === 'measurement' && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>दिनांक</th><th>कामाचा तपशील</th><th>ठिकाण</th><th className="num">नग</th><th className="num">लांबी</th><th className="num">रुंदी</th><th className="num">खोली/उंची</th><th className="num">परिमाण</th><th>एकक</th><th className="num">दर</th><th className="num">रक्कम</th></tr></thead>
                <tbody>
                  {work.measurements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.measured_on}</td><td>{m.description}</td><td>{m.location_note || '-'}</td>
                      <td className="num">{Number(m.nos)}</td><td className="num">{Number(m.length)}</td><td className="num">{Number(m.breadth)}</td><td className="num">{Number(m.depth)}</td>
                      <td className="num">{m.quantity.toFixed(3)}</td><td>{m.unit}</td><td className="num">{fmt(m.rate)}</td><td className="num">{fmt(m.amount)}</td>
                    </tr>
                  ))}
                  {work.measurements.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center' }}>मोजमाप नाही</td></tr>}
                  <tr><td colSpan={10} style={{ textAlign: 'right' }}><strong>एकूण</strong></td><td className="num"><strong>{fmt(s.measured_total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          )}

          {view === 'bills' && (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>देयक क्र.</th><th>दिनांक</th><th>कंत्राटदार</th><th className="num">आजपर्यंतचे मोजमाप</th><th className="num">आधीची देयके</th><th className="num">या देयकाची रक्कम</th><th className="num">कपात</th><th className="num">निव्वळ देय</th></tr></thead>
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
              {work.bills.length > 0 && (
                <p style={{ marginTop: 12 }}>
                  एकूण अदा: रु. {fmt(work.bills.reduce((t, b) => t + b.net_payable, 0))} (अक्षरी {amountToMarathiWords(work.bills.reduce((t, b) => t + b.net_payable, 0))})
                </p>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
            <span>सचिव / कनिष्ठ अभियंता</span><span>सरपंच</span>
          </div>
        </>
      )}
    </div>
  );
}
