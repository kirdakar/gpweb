import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

// नमुना १७ - अग्रिम/अनामत अहवाल (प्रिंट). डाटाएंट्री AdvanceDepositEntry.jsx
// (दैनिक व्यवहार) वर; हे फक्त वाचनीय स्वरूप.
export default function AdvanceDepositReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/advance-deposits', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const agrimRows = rows.filter((r) => r.kind === 'अग्रिम');
  const anamatRows = rows.filter((r) => r.kind === 'अनामत');

  function KindTable({ title, list }) {
    const totalAmount = list.reduce((s, r) => s + Number(r.amount), 0);
    const totalBalance = list.reduce((s, r) => s + Number(r.balance), 0);
    return (
      <div style={{ marginBottom: 24 }}>
        <h3>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>पक्षकार</th><th>तपशील</th><th>दिनांक</th><th>लेखाशीर्ष</th><th className="num">रक्कम</th><th className="num">भरलेले</th><th className="num">शिल्लक</th></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.party_name}</td>
                  <td>{r.description || '-'}</td>
                  <td>{fmtDate(r.entry_date)}</td>
                  <td>{r.head_code} - {r.head_name}</td>
                  <td className="num">{Number(r.amount).toFixed(2)}</td>
                  <td className="num">{Number(r.settled_amount).toFixed(2)}</td>
                  <td className="num">{Number(r.balance).toFixed(2)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr className="total-row"><td colSpan={4}>एकूण</td><td className="num">{totalAmount.toFixed(2)}</td><td /><td className="num">{totalBalance.toFixed(2)}</td></tr>
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
        <h1>अग्रिम/अनामत अहवाल (नमुना १७) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_advance_deposits', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>अग्रिम दिलेल्या/अनामत ठेवलेल्या रकमांची नोंदवही (नमुना १७)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <KindTable title="अग्रिम (दिलेली रक्कम)" list={agrimRows} />
          <KindTable title="अनामत (ठेवलेली/मिळालेली रक्कम)" list={anamatRows} />
        </>
      )}
    </div>
  );
}
