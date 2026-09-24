import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना ३३ - वृक्ष नोंदवही (प्रिंट). डाटाएंट्री TreeEntry.jsx वर.
export default function TreeReport() {
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  useEffect(() => { client.get('/trees').then(({ data }) => setRows([...data].reverse())); }, []);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वृक्ष नोंदवही अहवाल (नमुना ३३)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_trees', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>
      <div className="print-header"><h2>{gpLine}</h2><p style={{ fontWeight: 700 }}>वृक्ष नोंदवही (नमुना ३३)</p></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>जमिनीचा/रस्त्याचा तपशील</th><th>वृक्षाचा प्रकार</th><th>अधिक माहिती</th><th className="num">संख्या</th><th className="num">अपेक्षित वार्षिक उत्पन्न</th><th className="num">प्रत्यक्ष प्राप्त उत्पन्न</th><th>तोडल्यास/नष्ट झाल्यास तपशील</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.location_detail}</td><td>{t.tree_type}</td><td>{t.info || '-'}</td><td className="num">{t.tree_count}</td>
                <td className="num">{fmt(t.expected_annual_income)}</td><td className="num">{fmt(t.actual_income_total)}</td>
                <td>{t.disposal_date ? `${t.disposal_date} - ${t.disposal_details || ''}` : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            {rows.length > 0 && <tr><td colSpan={3} style={{ textAlign: 'right' }}><strong>एकूण</strong></td><td className="num"><strong>{rows.reduce((s, t) => s + t.tree_count, 0)}</strong></td><td className="num"><strong>{fmt(rows.reduce((s, t) => s + Number(t.expected_annual_income), 0))}</strong></td><td className="num"><strong>{fmt(rows.reduce((s, t) => s + t.actual_income_total, 0))}</strong></td><td /></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
