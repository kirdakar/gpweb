import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  '१ जानेवारी', '२ फेब्रुवारी', '३ मार्च', '४ एप्रिल', '५ मे', '६ जून',
  '७ जुलै', '८ ऑगस्ट', '९ सप्टेंबर', '१० ऑक्टोबर', '११ नोव्हेंबर', '१२ डिसेंबर',
];

// नमुना २१ - मासिक वेतन देयक अहवाल (प्रिंट). डाटाएंट्री StaffSalaryEntry.jsx
// (दैनिक व्यवहार) वर; हे फक्त वाचनीय स्वरूप.
export default function StaffSalaryReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/staff-salary-bills', { params: { financialYearId: yearId, year, month } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId, year, month]);

  const totals = rows.reduce((acc, r) => {
    acc.basic_pay += Number(r.basic_pay); acc.leave_pay += Number(r.leave_pay);
    acc.suspension_pay += Number(r.suspension_pay); acc.allowances += Number(r.allowances);
    acc.grossTotal += Number(r.grossTotal); acc.recovery_fine += Number(r.recovery_fine);
    acc.totalDeductions += Number(r.totalDeductions); acc.netPayable += Number(r.netPayable);
    return acc;
  }, { basic_pay: 0, leave_pay: 0, suspension_pay: 0, allowances: 0, grossTotal: 0, recovery_fine: 0, totalDeductions: 0, netPayable: 0 });

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक वेतन देयक अहवाल (नमुना २१)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_staff_salary_bills', 'print')}>प्रिंट</button>
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
        <p style={{ fontWeight: 700 }}>कर्मचाऱ्यांच्या वेतन देयकाची नोंदवही (नमुना २१)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''} | महिना: {MONTHS[month - 1]} {year}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>पद / कर्मचारी</th><th className="num">वेतन</th><th className="num">रजा वेतन</th>
                <th className="num">स्थानपन वेतन</th><th className="num">भत्ते</th><th className="num">एकूण</th>
                <th className="num">वसुली व दंड</th><th className="num">एकूण वजाती</th><th className="num">निव्वळ देय</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staff_id}>
                  <td>{r.post_name}{r.employee_name ? ` - ${r.employee_name}` : ''}</td>
                  <td className="num">{Number(r.basic_pay).toFixed(2)}</td>
                  <td className="num">{Number(r.leave_pay).toFixed(2)}</td>
                  <td className="num">{Number(r.suspension_pay).toFixed(2)}</td>
                  <td className="num">{Number(r.allowances).toFixed(2)}</td>
                  <td className="num">{Number(r.grossTotal).toFixed(2)}</td>
                  <td className="num">{Number(r.recovery_fine).toFixed(2)}</td>
                  <td className="num">{Number(r.totalDeductions).toFixed(2)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{Number(r.netPayable).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td>एकूण</td>
                  <td className="num">{totals.basic_pay.toFixed(2)}</td>
                  <td className="num">{totals.leave_pay.toFixed(2)}</td>
                  <td className="num">{totals.suspension_pay.toFixed(2)}</td>
                  <td className="num">{totals.allowances.toFixed(2)}</td>
                  <td className="num">{totals.grossTotal.toFixed(2)}</td>
                  <td className="num">{totals.recovery_fine.toFixed(2)}</td>
                  <td className="num">{totals.totalDeductions.toFixed(2)}</td>
                  <td className="num">{totals.netPayable.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
