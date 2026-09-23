import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना २ - पुनर्विनियोजन विवरणपत्र अहवाल (ज्ञापन प्रिंट). डाटाएंट्री
// BudgetRevision.jsx (दैनिक व्यवहार) वर; हे फक्त वाचनीय + पंचायत समितीला
// पाठवायचे ज्ञापन स्वरूप.
export default function BudgetRevisionReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine, settings } = useGpSettings();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/budget-revisions', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const jamaRows = useMemo(() => rows.filter((r) => r.group_type === 'जमा').sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const kharchRows = useMemo(() => rows.filter((r) => r.group_type === 'खर्च').sort((a, b) => a.sort_order - b.sort_order), [rows]);

  function GroupTable({ title, list }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>शीर्ष</th><th className="num">मंजूर अर्थसंकल्प</th><th className="num">सुधारित अंदाज</th><th className="num">अधिक(+) किंवा कमी(-)</th></tr>
            </thead>
            <tbody>
              {list.map((row) => {
                const diff = Number(row.revised_amount) - Number(row.approved_amount);
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="num">{Number(row.approved_amount).toFixed(2)}</td>
                    <td className="num">{Number(row.revised_amount).toFixed(2)}</td>
                    <td className="num" style={{ color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : undefined }}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>पुनर्विनियोजन अहवाल (नमुना २) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_budget_revision', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>पुनर्विनियोजन विवरणपत्र (नमुना २)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''} या वर्षासाठी मान्य केलेले पुनर्विनियोजन व नियतवाटप यांचे विवरणपत्र आहे.</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <GroupTable title="जमा शीर्ष" list={jamaRows} />
          <GroupTable title="खर्च शीर्ष" list={kharchRows} />
          <div style={{ marginTop: 24 }}>
            <p>ज्ञापन :</p>
            <p>दिनांक ....................... रोजी झालेल्या ग्रामपंचायत ठराव क्रमांक ....................... अन्वये मान्य केलेले पुनर्विनियोजन व नियतवाटप यांचे विवरणपत्र खाली सही करणारी व्यक्ती माहे ....................... सन ....................... करिता पाठवीत आहे.</p>
            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
              <span>सचिवांची सही</span>
              <span>सरपंच{settings?.gp_name ? `, ${settings.gp_name}` : ''}</span>
            </div>
            <p style={{ marginTop: 24 }}>प्रति, मे. गटविकास अधिकारी पंचायत समिती ....................... जिल्हा {settings?.district || '.......................'} यांस सादर</p>
          </div>
        </>
      )}
    </div>
  );
}
