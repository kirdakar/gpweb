import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

export default function SummaryReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/summary', { params: { yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const yearLabel = years.find((y) => y.id === yearId)?.year_label || '';
  const grandTotal = rows.reduce((s, r) => s + Number(r.grand_total || 0), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मालकनिहाय सारांश अहवाल</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_summary', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>मालकनिहाय एकत्रित कर सारांश</h2>
        <p>आर्थिक वर्ष: {yearLabel}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>कोड</th><th>मालकाचे नाव</th><th>मालमत्ता क्रमांक</th><th className="num">भाग संख्या</th>
                <th className="num">घरपट्टी</th><th className="num">दिवाबत्ती</th><th className="num">आरोग्य</th><th className="num">पाणीपट्टी</th><th className="num">एकूण</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.property_code}>
                  <td>{r.property_code ?? '-'}</td>
                  <td>{r.owner_name}</td>
                  <td>{r.malmata_no_list}</td>
                  <td className="num">{r.portion_count}</td>
                  <td className="num">{Number(r.total_gharpatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.total_divabatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.total_arogya || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.total_panipatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.grand_total || 0).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={8}>एकूण कर मागणी</td>
                  <td className="num">{grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
