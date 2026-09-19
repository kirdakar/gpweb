import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const COMPONENTS = [
  { key: 'gharpatti', label: 'घरपट्टी' },
  { key: 'divabatti', label: 'दिवाबत्ती' },
  { key: 'arogya', label: 'आरोग्य कर' },
  { key: 'panipatti', label: 'पाणीपट्टी' },
];

function groupSum(row, prefix) {
  return COMPONENTS.reduce((s, c) => s + Number(row[`${prefix}_${c.key}`] || 0), 0);
}

export default function PaymentReceiptsReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/payment-receipts', { params: { yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const yearLabel = years.find((y) => y.id === yearId)?.year_label || '';

  const totals = rows.reduce((acc, r) => {
    acc.amount += Number(r.amount || 0);
    for (const c of COMPONENTS) {
      acc[`previous_${c.key}`] = (acc[`previous_${c.key}`] || 0) + Number(r[`previous_${c.key}`] || 0);
      acc[`current_${c.key}`] = (acc[`current_${c.key}`] || 0) + Number(r[`current_${c.key}`] || 0);
    }
    acc.previous_total += groupSum(r, 'previous');
    acc.current_total += groupSum(r, 'current');
    return acc;
  }, { amount: 0, previous_total: 0, current_total: 0 });

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>जमा पावती अहवाल</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_payment_receipts', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>ग्रामपंचायत जमा पावती अहवाल</h2>
        <p>आर्थिक वर्ष: {yearLabel}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>पावती क्र.</th>
                <th rowSpan={2}>दिनांक</th>
                <th rowSpan={2}>मालकाचे नाव</th>
                <th rowSpan={2}>मालमत्ता क्र.</th>
                <th rowSpan={2} className="num">जमा रक्कम</th>
                <th colSpan={5}>मागील बाकीतून वसूल</th>
                <th colSpan={5}>चालू वर्षातून वसूल</th>
                <th colSpan={5}>येणे बाकी (पावतीनंतर)</th>
              </tr>
              <tr>
                {COMPONENTS.map((c) => <th key={`p-${c.key}`} className="num">{c.label}</th>)}
                <th className="num">एकूण</th>
                {COMPONENTS.map((c) => <th key={`c-${c.key}`} className="num">{c.label}</th>)}
                <th className="num">एकूण</th>
                {COMPONENTS.map((c) => <th key={`r-${c.key}`} className="num">{c.label}</th>)}
                <th className="num">एकूण</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.payment_date}</td>
                  <td>{r.owner_name}</td>
                  <td>{r.malmata_no ?? '-'}</td>
                  <td className="num">{Number(r.amount).toFixed(2)}</td>
                  {COMPONENTS.map((c) => <td key={`p-${c.key}`} className="num">{Number(r[`previous_${c.key}`] || 0).toFixed(2)}</td>)}
                  <td className="num" style={{ fontWeight: 600 }}>{groupSum(r, 'previous').toFixed(2)}</td>
                  {COMPONENTS.map((c) => <td key={`c-${c.key}`} className="num">{Number(r[`current_${c.key}`] || 0).toFixed(2)}</td>)}
                  <td className="num" style={{ fontWeight: 600 }}>{groupSum(r, 'current').toFixed(2)}</td>
                  {COMPONENTS.map((c) => <td key={`r-${c.key}`} className="num" style={{ color: 'var(--text-muted)' }}>{Number(r[`remaining_${c.key}`] || 0).toFixed(2)}</td>)}
                  <td className="num" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{groupSum(r, 'remaining').toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={20} style={{ textAlign: 'center' }}>या वर्षात कोणतीही जमा नोंद नाही</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>एकूण</td>
                  <td className="num">{totals.amount.toFixed(2)}</td>
                  {COMPONENTS.map((c) => <td key={`tp-${c.key}`} className="num">{(totals[`previous_${c.key}`] || 0).toFixed(2)}</td>)}
                  <td className="num">{totals.previous_total.toFixed(2)}</td>
                  {COMPONENTS.map((c) => <td key={`tc-${c.key}`} className="num">{(totals[`current_${c.key}`] || 0).toFixed(2)}</td>)}
                  <td className="num">{totals.current_total.toFixed(2)}</td>
                  {COMPONENTS.map((c) => <td key={`tr-${c.key}`} className="num">-</td>)}
                  <td className="num">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
