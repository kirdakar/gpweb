import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

// नमुना ३१ - प्रवास भत्ता देयक अहवाल (प्रिंट). डाटाएंट्री TravelBillEntry.jsx
// (दैनिक व्यवहार) वर; हे फक्त वाचनीय स्वरूप.
export default function TravelBillReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/travel-bills', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const totals = rows.reduce((acc, r) => {
    acc.fare += Number(r.fare_amount); acc.mileage += Number(r.mileage_amount);
    acc.daily += Number(r.daily_allowance_amount); acc.total += Number(r.total_amount);
    return acc;
  }, { fare: 0, mileage: 0, daily: 0, total: 0 });

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>प्रवास भत्ता देयक अहवाल (नमुना ३१) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_travel_bills', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>प्रवास भत्ता देयक (नमुना ३१)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>नाव</th><th>दिनांक</th><th>कोठून-कोठे</th><th>कारण</th><th className="num">भाडे</th><th className="num">मैल भत्ता</th><th className="num">दैनिक भत्ता</th><th className="num">एकूण</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.traveller_name}</td>
                  <td>{fmtDate(r.travel_date)}</td>
                  <td>{r.from_place || '-'} - {r.to_place || '-'}</td>
                  <td>{r.purpose || '-'}</td>
                  <td className="num">{Number(r.fare_amount).toFixed(2)}</td>
                  <td className="num">{Number(r.mileage_amount).toFixed(2)}</td>
                  <td className="num">{Number(r.daily_allowance_amount).toFixed(2)}</td>
                  <td className="num">{Number(r.total_amount).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>एकूण</td>
                  <td className="num">{totals.fare.toFixed(2)}</td>
                  <td className="num">{totals.mileage.toFixed(2)}</td>
                  <td className="num">{totals.daily.toFixed(2)}</td>
                  <td className="num">{totals.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
