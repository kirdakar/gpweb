import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  '१ जानेवारी', '२ फेब्रुवारी', '३ मार्च', '४ एप्रिल', '५ मे', '६ जून',
  '७ जुलै', '८ ऑगस्ट', '९ सप्टेंबर', '१० ऑक्टोबर', '११ नोव्हेंबर', '१२ डिसेंबर',
];

// नमुना २७ - लेखापरीक्षणातील आक्षेपांच्या पूर्ततेचे मासिक विवरण. नमुना ३०
// च्या पूर्तता नोंदींवरूनच (audit_compliance_logs) निवडलेल्या महिन्याचे आकडे
// आपोआप काढतो - स्वतंत्र नोंद नाही (नमुना ५ -> ६ प्रमाणेच).
export default function AuditMonthlyReport() {
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
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

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>आक्षेप पूर्ततेचे मासिक विवरण (नमुना २७)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_audit_monthly', 'print')}>प्रिंट</button>
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

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>लेखापरीक्षणातील आक्षेपांच्या पूर्ततेचे मासिक विवरण (नमुना २७)</p>
        <p>महिना: {MONTHS[month - 1]} {year}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>अ.क्र.</th><th>अहवालाचे वर्ष</th><th className="num">परिच्छेद संख्या</th><th className="num">या महिन्यात पूर्तता</th>
                <th className="num">पं.स. मान्य</th><th className="num">लेखा परीक्षक मान्य</th><th className="num">प्रलंबित</th><th>पूर्तता न केल्याची कारणे</th><th>शेरा</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.report_year}</td>
                  <td className="num">{r.total_objections}</td>
                  <td className="num">{r.complied_in_month}</td>
                  <td className="num">{r.ps_accepted_in_month}</td>
                  <td className="num">{r.auditor_accepted_in_month}</td>
                  <td className="num">{r.pending_count}</td>
                  <td>{r.pending_reason || '-'}</td>
                  <td>{r.remark || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
