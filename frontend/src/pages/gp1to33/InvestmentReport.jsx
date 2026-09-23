import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना २५ - गुंतवणूक अहवाल (प्रिंट). डाटाएंट्री InvestmentEntry.jsx
// (दैनिक व्यवहार) वर; हे फक्त वाचनीय स्वरूप.
export default function InvestmentReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/investments', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const totalPurchase = rows.reduce((s, r) => s + Number(r.purchase_price), 0);
  const totalMatured = rows.filter((r) => r.is_matured).reduce((s, r) => s + Number(r.matured_amount), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>गुंतवणूक अहवाल (नमुना २५) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_investments', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>गुंतवणूक नोंदवही (नमुना २५)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>तपशील</th><th>गुंतवणूक दिनांक</th><th>लेखाशीर्ष</th><th className="num">खरेदी किंमत</th><th>मुदत दिनांक</th><th className="num">परिणत रक्कम</th><th>स्थिती</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.description}</td>
                  <td>{r.investment_date?.slice(0, 10)}</td>
                  <td>{r.head_code} - {r.head_name}</td>
                  <td className="num">{Number(r.purchase_price).toFixed(2)}</td>
                  <td>{r.maturity_date?.slice(0, 10) || '-'}</td>
                  <td className="num">{r.matured_amount ? Number(r.matured_amount).toFixed(2) : '-'}</td>
                  <td>{r.is_matured ? 'परिपक्व' : 'सुरू'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row"><td colSpan={3}>एकूण</td><td className="num">{totalPurchase.toFixed(2)}</td><td /><td className="num">{totalMatured.toFixed(2)}</td><td /></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
