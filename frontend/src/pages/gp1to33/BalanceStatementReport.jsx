import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];

// नमुना २६-ख - मासिक शिल्लक विवरण अहवाल (प्रिंट). डाटाएंट्री
// BalanceStatementEntry.jsx (दैनिक व्यवहार) वर.
export default function BalanceStatementReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/balance-statements', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const allMatch = rows.length > 0 && rows.every((r) => r.entered && r.difference === 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक शिल्लक विवरण अहवाल (नमुना २६-ख) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_balance_statements', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>सन {currentYear?.year_label || ''} या वर्षाचे मासिक शिल्लक विवरण (नमुना २६-ख)</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>महिना</th><th className="num">प्रारंभिक शिल्लक</th><th className="num">सचिवाकडील हातची</th><th className="num">बँकेतील</th>
                  <th className="num">पोस्टातील</th><th className="num">अल्पबचत प्रमाणपत्रे</th><th className="num">मुदत ठेव</th><th className="num">एकूण</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.year}-${r.month}`}>
                    <td>{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="num">{r.opening.toFixed(2)}</td>
                    <td className="num">{r.in_hand.toFixed(2)}</td>
                    <td className="num">{r.in_bank.toFixed(2)}</td>
                    <td className="num">{r.in_post.toFixed(2)}</td>
                    <td className="num">{r.savings_certificates.toFixed(2)}</td>
                    <td className="num">{r.fixed_deposits.toFixed(2)}</td>
                    <td className="num">{r.components_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 16 }}>
            {allMatch
              ? 'प्रमाणित करण्यात येते की, वरील प्रत्येक महिन्याची शिल्लक नमुना क्र. ५ मधील रोख वहीतील शिल्लकेएवढी आहे.'
              : 'सूचना: काही महिन्यांची विभागणी अद्याप भरलेली नाही किंवा एकूण शिल्लक रोकड वहीतील शिल्लकेशी जुळत नाही - दैनिक व्यवहारमधील नमुना २६-ख नोंदणीत "फरक" तपासा.'}
          </p>
        </>
      )}
    </div>
  );
}
