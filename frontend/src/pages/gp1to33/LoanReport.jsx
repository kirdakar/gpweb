import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

// नमुना २९ - कर्ज अहवाल (प्रिंट). डाटाएंट्री LoanEntry.jsx (दैनिक व्यवहार)
// वर; हे फक्त वाचनीय स्वरूप.
export default function LoanReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/loans', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const totalLoan = rows.reduce((s, r) => s + Number(r.loan_amount), 0);
  const totalPrincipalPaid = rows.reduce((s, r) => s + Number(r.principal_paid), 0);
  const totalInterestPaid = rows.reduce((s, r) => s + Number(r.interest_paid), 0);
  const totalBalance = rows.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर्ज अहवाल (नमुना २९) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_loans', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>कर्जाची नोंदवही (नमुना २९)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>साधन</th><th>प्रयोजन</th><th>मिळाल्याची तारीख</th><th className="num">कर्ज रक्कम</th><th className="num">मुद्दल परतफेड</th><th className="num">व्याज भरणा</th><th className="num">शिल्लक</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.source}</td>
                  <td>{r.purpose || '-'}</td>
                  <td>{fmtDate(r.received_date) || '-'}</td>
                  <td className="num">{Number(r.loan_amount).toFixed(2)}</td>
                  <td className="num">{Number(r.principal_paid).toFixed(2)}</td>
                  <td className="num">{Number(r.interest_paid).toFixed(2)}</td>
                  <td className="num">{Number(r.balance).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row"><td colSpan={3}>एकूण</td><td className="num">{totalLoan.toFixed(2)}</td><td className="num">{totalPrincipalPaid.toFixed(2)}</td><td className="num">{totalInterestPaid.toFixed(2)}</td><td className="num">{totalBalance.toFixed(2)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
