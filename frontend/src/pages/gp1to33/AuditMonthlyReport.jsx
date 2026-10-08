import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const WIDTHS = [5, 11, 10, 11, 12, 13, 11, 17, 10];

// नमुना २७ (नियम ७३(२) पाहा) - लेखापरीक्षणातील आक्षेपांच्या पूर्ततेचे मासिक विवरण, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर ९ रकान्यांसह.
// डाटाएंट्री AuditReportEntry.jsx (नमुना ३०) वर; इथे निवडलेल्या महिन्याचे आकडे त्याच पूर्तता नोंदींवरून आपोआप (स्वतंत्र नोंद नाही).
// (४)(५) = त्या महिन्यातील; (६) = महिन्याअखेरपर्यंतचे लेखा परीक्षकाने मान्य केलेले; (७) प्रलंबित = एकूण - केवळ माहितीसाठी - (६).
export default function AuditMonthlyReport() {
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get('/audit-reports/monthly', { params: { year, month } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [year, month]);

  // एकच अहवाल-वर्ष असेल तर "सन ..." ओळीत भरतो, नाहीतर ठिपके (हाताने)
  const reportYears = [...new Set(rows.map((r) => r.report_year).filter(Boolean))];
  const yearText = reportYears.length === 1 ? reportYears[0] : '२०.... -२०....';

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>आक्षेप पूर्ततेचे मासिक विवरण (नमुना २७)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_audit_monthly', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २७</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम ७३(२) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0' }}>लेखापरीक्षणातील आक्षेपांच्या पूर्ततेचे मासिक विवरण</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '4px 0' }}>
            <span>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</span>
            <span>महिना <strong>{MONTHS[month - 1]}</strong> &nbsp; वर्ष <strong>{year}</strong></span>
          </div>
          <div style={{ fontSize: 13, margin: '2px 0 8px' }}>
            सन <strong>{yearText}</strong> या वर्षाच्या लेखा परीक्षा निरीक्षणाच्या अहवालातील आक्षेपांचे पूर्तता दर्शविणारे विवरण
          </div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th>अ. क्र.</th>
                  <th>लेखापरीक्षण अहवालाचे वर्ष</th>
                  <th>लेखापरीक्षण अहवालातील परिच्छेद संख्या</th>
                  <th>ग्रामपंचायतीने या महिन्यात पूर्तता केलेल्या परिच्छेदांची संख्या</th>
                  <th>पंचायत समितीने आक्षेपाद्वारे मान्य केलेल्या पूर्ततांची संख्या</th>
                  <th>लेखा परीक्षकाने ज्या बाबतीत पूर्तता मान्य केली आहे त्या आक्षेपांची संख्या</th>
                  <th>प्रलंबित असलेल्या आक्षेपांची संख्या (३-६)</th>
                  <th>पूर्तता न केल्याबद्दलची कारणे</th>
                  <th>शेरा</th>
                </tr>
                <tr className="cb-numrow">{Array.from({ length: 9 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 14 }}>नोंदी नाहीत</td></tr>}
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ height: 40 }}>
                    <td className="num">{mnum(i + 1)}</td>
                    <td>{r.report_year}</td>
                    <td className="num">{r.total_objections}</td>
                    <td className="num">{r.complied_in_month}</td>
                    <td className="num">{r.ps_accepted_in_month}</td>
                    <td className="num">{r.auditor_accepted_total ?? r.auditor_accepted_in_month}</td>
                    <td className="num"><strong>{r.pending_count}</strong></td>
                    <td className="cb-name">{r.pending_reason || ''}</td>
                    <td className="cb-name">{[r.info_only_count ? `केवळ माहितीसाठी: ${r.info_only_count}` : '', r.remark || ''].filter(Boolean).join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cb-note">टीप.- लेखापरीक्षण अहवालातील परिच्छेदांची पूर्तता त्वरित करावयाची आहे.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 13 }}>
            <span>सचिवाची सही</span><span>सरपंचाची सही</span>
          </div>
        </div>
      )}
    </div>
  );
}
