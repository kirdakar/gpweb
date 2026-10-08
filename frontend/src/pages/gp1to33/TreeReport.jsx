import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const PER_PAGE = 12;
const W = [20, 12, 16, 8, 12, 12, 20];

// नमुना ३३ (नियम ७० पाहा) - वृक्ष नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर ७ रकाने (१-७).
// डाटाएंट्री TreeEntry.jsx वर; "प्रत्यक्ष प्राप्त उत्पन्न" = त्या वृक्षावर नोंदवलेल्या उत्पन्नाची बेरीज (रोकड वहीत जमा झालेली).
export default function TreeReport() {
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    client.get('/trees').then(({ data }) => setRows([...data].reverse())).finally(() => setLoading(false)); // जुने आधी
  }, []);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वृक्ष नोंदवही अहवाल (नमुना ३३)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_trees', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>नोंदी नाहीत.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ३३</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम ७० पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>वृक्ष नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <table className="cl-table">
            <colgroup>{W.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>जमिनीचा/रस्त्याचा तपशील (आधारसामग्रीसह)</th><th>वृक्षाचा प्रकार</th><th>वृक्षाविषयीची अधिक माहिती</th>
                <th>वृक्षांची संख्या</th><th>अपेक्षित वार्षिक उत्पन्न</th><th>प्रत्यक्ष प्राप्त उत्पन्न</th><th>वृक्ष तोडल्यास/नष्ट झाल्यास त्याबाबतचा तपशील</th>
              </tr>
              <tr className="cl-numrow">{[1, 2, 3, 4, 5, 6, 7].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} style={{ height: 34 }}>
                  <td className="cl-name">{t.location_detail}</td>
                  <td className="cl-name">{t.tree_type}</td>
                  <td className="cl-name">{t.info || ''}</td>
                  <td className="num">{t.tree_count}</td>
                  <td className="num">{Number(t.expected_annual_income) ? fmt(t.expected_annual_income) : ''}</td>
                  <td className="num">{Number(t.actual_income_total) ? fmt(t.actual_income_total) : ''}</td>
                  <td className="cl-name">{t.disposal_date ? `${fmtDate(t.disposal_date)}${t.disposal_details ? ` - ${t.disposal_details}` : ''}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
