import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const cell = (n) => (n == null || n === '' ? '' : Number(n).toFixed(2));
const PER_PAGE = 3;
const W1 = [4, 16, 16, 16, 10, 8, 10, 20];
const W2 = [4, 9, 8, 8, 10, 10, 9, 10, 10, 7, 7, 8];

// नमुना २९ (नियम २९ पाहा) - कर्जाची नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते (१: अ. क्र., कर्जाची उभारणीची साधने, मंजुरीचा आदेश
// क्रमांक व दिनांक, प्रयोजन, रक्कम, व्याज दर, कर्ज मिळाल्याची तारीख, हप्त्यांची संख्या व नियत तारीख; २: प्रत्येक हप्त्यातील मुद्दल/व्याज,
// सह्या, प्रदानाचा तपशील - दिनांक, मुद्दल, व्याज, एकूण - व शिल्लक मुद्दल). डाटाएंट्री LoanEntry.jsx वर; प्रदान ओळी "हप्ता भरा" ने नोंदलेल्या
// हप्त्यांवरून आपोआप, शिल्लक मुद्दल = कर्ज - आजपर्यंत भरलेले मुद्दल. शिल्लक व्याज स्वतंत्र साठवले जात नाही - हाताने लिहावे.
export default function LoanReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/loans', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows([...data].reverse())) // जुने आधी
      .finally(() => setLoading(false));
  }, [yearId]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर्ज अहवाल (नमुना २९) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_loans', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>या वर्षात नोंदी नाहीत.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २९</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २९ पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>कर्जाची नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; (सन {currentYear?.year_label})</div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>अ. क्र.</th><th>कर्जाची उभारणीची साधने</th><th>कर्ज मंजुरीचा आदेश क्रमांक व दिनांक</th><th>कर्जाचे प्रयोजन</th>
                <th>कर्जाची रक्कम</th><th>व्याज दर</th><th>कर्ज मिळाल्याची तारीख</th><th>कर्ज व व्याज परतफेडीच्या हप्त्यांची संख्या व नियत तारीख</th>
              </tr>
              <tr className="cl-numrow"><th>(१)</th>{[2, 3, 4, 5, 6, 7, 8].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((l, i) => (
                <tr key={l.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td className="cl-name">{l.source}</td>
                  <td className="cl-name">{[l.sanction_order_no, l.sanction_date ? fmtDate(l.sanction_date) : ''].filter(Boolean).join(' / ')}</td>
                  <td className="cl-name">{l.purpose || ''}</td>
                  <td className="num">{fmt(l.loan_amount)}</td>
                  <td className="num">{l.interest_rate != null ? `${Number(l.interest_rate)}%` : ''}</td>
                  <td>{l.received_date ? fmtDate(l.received_date) : ''}</td>
                  <td className="cl-name">{[l.installment_count ? `${l.installment_count} हप्ते` : '', l.installment_dates || ''].filter(Boolean).join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>अ. क्र.</th>
                <th colSpan={2}>प्रत्येक हप्त्यातील मुद्दलाची व व्याजाची रक्कम</th>
                <th rowSpan={2}>सचिवाची सही</th>
                <th colSpan={4}>प्रदानाचा तपशील</th>
                <th colSpan={2}>शिल्लक रक्कम</th>
                <th rowSpan={2}>सचिवाची सही</th>
                <th rowSpan={2}>शेरा</th>
              </tr>
              <tr><th>कर्ज</th><th>व्याज</th><th>दिनांक</th><th>मुद्दल</th><th>व्याज</th><th>एकूण</th><th>मुद्दल</th><th>व्याज</th></tr>
              <tr className="cl-numrow"><th />{['९', '९', '१०', '११', '१२', '१३', '१४', '१५', '१६', '१७', '१८'].map((n, i) => <th key={i}>({n})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((l, li) => {
                const reps = l.repayments || [];
                const lines = Math.max(reps.length, 1);
                let paid = 0;
                const trs = [];
                for (let i = 0; i < lines; i += 1) {
                  const r = reps[i];
                  if (r) paid += r.principal_amount;
                  trs.push(
                    <tr key={`${l.id}-${i}`}>
                      {i === 0 && <td rowSpan={lines} className="num">{mnum(pi * PER_PAGE + li + 1)}</td>}
                      {i === 0 && <td rowSpan={lines} className="num">{cell(l.installment_principal)}</td>}
                      {i === 0 && <td rowSpan={lines} className="num">{cell(l.installment_interest)}</td>}
                      {i === 0 && <td rowSpan={lines} />}
                      <td>{r ? fmtDate(r.repayment_date) : ''}</td>
                      <td className="num">{r ? cell(r.principal_amount) : ''}</td>
                      <td className="num">{r ? cell(r.interest_amount) : ''}</td>
                      <td className="num">{r ? fmt(r.principal_amount + r.interest_amount) : ''}</td>
                      <td className="num">{r ? fmt(Number(l.loan_amount) - paid) : ''}</td>
                      <td />
                      <td />
                      {i === 0 && <td rowSpan={lines} className="cl-name">{l.remark || ''}</td>}
                    </tr>
                  );
                }
                return trs;
              })}
            </tbody>
          </table>

          <div className="cb-note">टीप.- सरपंच दर तीन महिन्यांनी नोंद पडताळून पाहतील.</div>
        </div>
      ))}
    </div>
  );
}
