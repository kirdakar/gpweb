import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

// नमुना ३० - लेखापरीक्षण आक्षेप पूर्तता नोंदवही (प्रिंट). डाटाएंट्री
// AuditReportEntry.jsx (दैनिक व्यवहार) वर; एकूण पूर्तता/मंजूर आकडे पूर्तता
// नोंदींवरून (logs) आपोआप काढलेले.
export default function AuditRegisterReport() {
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/audit-reports').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>लेखापरीक्षण आक्षेप पूर्तता नोंदवही (नमुना ३०)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_audit_register', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>ग्रामपंचायत लेखापरीक्षण आक्षेप पूर्तता नोंदवही (नमुना ३०)</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>वर्ष</th><th>प्राप्त दिनांक</th><th className="num">एकूण</th><th className="num">फक्त माहिती</th><th className="num">पूर्तता आवश्यक</th>
                <th className="num">पूर्तता केलेले</th><th>पं.स. जावक</th><th className="num">पं.स. मान्य</th><th className="num">लेखा परीक्षक मंजूर</th>
                <th className="num">पु.स.</th><th className="num">वसुली</th><th className="num">मूल्यांकन</th><th className="num">नियमबाह्य</th><th className="num">शिल्लक एकूण</th><th>शेरा</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.report_year}</td>
                  <td>{fmtDate(r.received_date) || '-'}</td>
                  <td className="num">{r.total_objections}</td>
                  <td className="num">{r.info_only_count}</td>
                  <td className="num">{r.to_comply_count}</td>
                  <td className="num">{r.complied_total}</td>
                  <td>{r.outward_no || '-'}</td>
                  <td className="num">{r.ps_accepted_total}</td>
                  <td className="num">{r.auditor_accepted_total}</td>
                  <td className="num">{r.rem_book_adjustment}</td>
                  <td className="num">{r.rem_recovery}</td>
                  <td className="num">{r.rem_valuation}</td>
                  <td className="num">{r.rem_irregular}</td>
                  <td className="num">{r.rem_total}</td>
                  <td>{r.remark || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={15} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
