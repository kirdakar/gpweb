import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना २ - पुनर्विनियोजन विवरणपत्र. कागदी नमुना फक्त मुख्य गट स्तरावर
// (उदा. "एक(अ) कर") मंजूर अर्थसंकल्प वि. सुधारित अंदाज दाखवतो, प्रत्येक
// उप-शीर्षासाठी नाही - नमुना १ पेक्षा वेगळी, खूप कमी वापरली जाणारी नोंद.
export default function BudgetRevision() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine, settings } = useGpSettings();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/budget-revisions', { params: { financialYearId: yearId } })
      .then(({ data }) => { setRows(data); setEdits({}); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const jamaRows = useMemo(() => rows.filter((r) => r.group_type === 'जमा').sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const kharchRows = useMemo(() => rows.filter((r) => r.group_type === 'खर्च').sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const canEdit = can('budget_revisions', 'edit');

  function revisedValue(row) {
    const v = edits[row.id];
    return v !== undefined ? v : row.revised_amount;
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const entries = Object.entries(edits).map(([ledger_head_id, v]) => ({
        ledger_head_id: Number(ledger_head_id),
        revised_amount: Number(v) || 0,
      }));
      if (entries.length === 0) return;
      await client.put('/budget-revisions', { financial_year_id: yearId, entries });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setSaving(false);
    }
  }

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
                const revised = Number(revisedValue(row) || 0);
                const diff = revised - Number(row.approved_amount);
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="num">{Number(row.approved_amount).toFixed(2)}</td>
                    <td className="num">
                      {canEdit ? (
                        <input type="number" step="0.01" value={revisedValue(row)}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          style={{ width: 120, padding: 4, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
                      ) : revised.toFixed(2)}
                    </td>
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
        <h1>पुनर्विनियोजन विवरणपत्र (नमुना २) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'जतन करा'}</button>}
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('budget_revisions', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {error && <div className="error-box no-print">{error}</div>}

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
