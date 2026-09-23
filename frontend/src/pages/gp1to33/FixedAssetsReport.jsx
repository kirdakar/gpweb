import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const CATEGORIES = [
  { value: 'जंगम', label: 'जंगम मालमत्ता नोंदवही (नमुना १६)' },
  { value: 'स्थावर', label: 'स्थावर मालमत्ता नोंदवही (नमुना २२)' },
  { value: 'रस्ते', label: 'रस्त्यांची नोंदवही (नमुना २३)' },
  { value: 'जमीन', label: 'जमिनींची नोंदवही (नमुना २४)' },
];

// नमुना १६/२२/२३/२४ - चारही मालमत्ता नोंदवह्यांचा प्रिंट अहवाल, एकाच
// पानावर एकत्र (डाटाएंट्री FixedAssetsEntry.jsx वर, दैनिक व्यवहार मध्ये).
export default function FixedAssetsReport() {
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get('/fixed-assets').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  function CategoryTable({ category, label }) {
    const list = rows.filter((r) => r.category === category);
    const total = list.reduce((s, r) => s + Number(r.cost_amount || 0), 0);
    return (
      <div style={{ marginBottom: 24 }}>
        <h3>{label}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>वर्णन</th><th>दिनांक</th><th>आधार</th><th>संख्या/परिमाण</th><th className="num">रक्कम</th><th>विल्हेवाट</th></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.description}</td>
                  <td>{r.acquired_date?.slice(0, 10) || '-'}</td>
                  <td>{r.acquired_mode || '-'}</td>
                  <td>{r.quantity_or_measure || '-'}</td>
                  <td className="num">{Number(r.cost_amount).toFixed(2)}</td>
                  <td>{r.disposal_date ? `${r.disposal_date.slice(0, 10)} - ${r.disposal_details || ''}` : '-'}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr className="total-row"><td colSpan={4}>एकूण</td><td className="num">{total.toFixed(2)}</td><td /></tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मालमत्ता अहवाल (नमुना १६/२२/२३/२४)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_fixed_assets', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>मालमत्ता नोंदवही (नमुना १६/२२/२३/२४)</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        CATEGORIES.map((c) => <CategoryTable key={c.value} category={c.value} label={c.label} />)
      )}
    </div>
  );
}
