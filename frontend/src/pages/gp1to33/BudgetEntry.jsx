import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना १ - वार्षिक अंदाजपत्रक. प्रत्येक leaf शीर्षासाठी प्रस्तावित/मंजूर
// अंदाज संपादित करता येतो; मागील वर्ष/गतपूर्व वर्षाची प्रत्यक्ष रक्कम
// (कॉलम ४/५) फक्त वाचनीय, backend ने cash_book_entries वरून काढलेली.
function buildTree(rows) {
  const byParent = new Map();
  for (const r of rows) {
    const key = r.parent_id ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(r);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);
  return byParent;
}

function TreeRows({ node, byParent, depth, edits, onEdit, canEdit, printMode }) {
  const children = byParent.get(node.id) || [];
  const edited = edits[node.id] || {};
  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{node.code}</td>
        <td style={{ paddingLeft: 12 + depth * 18 }}>
          <span style={{ fontWeight: node.is_leaf ? 400 : 700 }}>{node.name}</span>
        </td>
        {node.is_leaf ? (
          <>
            <td className="num">
              {canEdit && !printMode ? (
                <input type="number" step="0.01" value={edited.proposed_amount ?? node.proposed_amount}
                  onChange={(e) => onEdit(node.id, 'proposed_amount', e.target.value)}
                  style={{ width: 110, padding: 4, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
              ) : Number(edited.proposed_amount ?? node.proposed_amount).toFixed(2)}
            </td>
            <td className="num">
              {canEdit && !printMode ? (
                <input type="number" step="0.01" value={edited.approved_amount ?? node.approved_amount}
                  onChange={(e) => onEdit(node.id, 'approved_amount', e.target.value)}
                  style={{ width: 110, padding: 4, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
              ) : Number(edited.approved_amount ?? node.approved_amount).toFixed(2)}
            </td>
            <td className="num">{Number(node.previous_year_actual).toFixed(2)}</td>
            <td className="num">{Number(node.year_before_previous_actual).toFixed(2)}</td>
          </>
        ) : (
          <>
            <td /><td /><td /><td />
          </>
        )}
      </tr>
      {children.map((child) => (
        <TreeRows key={child.id} node={child} byParent={byParent} depth={depth + 1}
          edits={edits} onEdit={onEdit} canEdit={canEdit} printMode={printMode} />
      ))}
    </>
  );
}

export default function BudgetEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/budget-entries', { params: { financialYearId: yearId } })
      .then(({ data }) => { setData(data); setEdits({}); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  function onEdit(headId, field, value) {
    setEdits((prev) => ({ ...prev, [headId]: { ...prev[headId], [field]: value } }));
  }

  const jamaTree = useMemo(() => buildTree((data?.heads || []).filter((h) => h.group_type === 'जमा')), [data]);
  const kharchTree = useMemo(() => buildTree((data?.heads || []).filter((h) => h.group_type === 'खर्च')), [data]);
  const canEdit = can('budget_entries', 'edit');

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const entries = Object.entries(edits).map(([ledger_head_id, v]) => {
        const head = data.heads.find((h) => h.id === Number(ledger_head_id));
        return {
          ledger_head_id: Number(ledger_head_id),
          proposed_amount: Number(v.proposed_amount ?? head.proposed_amount) || 0,
          approved_amount: Number(v.approved_amount ?? head.approved_amount) || 0,
        };
      });
      if (entries.length === 0) return;
      await client.put('/budget-entries', { financial_year_id: yearId, entries });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वार्षिक अंदाजपत्रक (नमुना १) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'जतन करा'}</button>}
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('budget_entries', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {error && <div className="error-box no-print">{error}</div>}

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>वार्षिक अंदाजपत्रक (नमुना १)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}{data?.previous_year ? ` | मागील वर्ष: ${data.previous_year.year_label}` : ''}{data?.year_before_previous ? ` | गतपूर्व वर्ष: ${data.year_before_previous.year_label}` : ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <h3 style={{ color: '#1d4ed8' }}>जमा शीर्ष</h3>
          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <table>
              <thead>
                <tr>
                  <th>कोड</th><th>जमा शीर्ष</th>
                  <th className="num">प्रस्तावित अंदाज</th><th className="num">मंजूर अंदाज</th>
                  <th className="num">मागील वर्षी प्रत्यक्ष</th><th className="num">गतपूर्व वर्षी प्रत्यक्ष</th>
                </tr>
              </thead>
              <tbody>
                {(jamaTree.get('root') || []).map((node) => (
                  <TreeRows key={node.id} node={node} byParent={jamaTree} depth={0}
                    edits={edits} onEdit={onEdit} canEdit={canEdit} printMode={false} />
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ color: '#dc2626' }}>खर्च शीर्ष</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>कोड</th><th>खर्च शीर्ष</th>
                  <th className="num">प्रस्तावित अंदाज</th><th className="num">मंजूर अंदाज</th>
                  <th className="num">मागील वर्षी प्रत्यक्ष</th><th className="num">गतपूर्व वर्षी प्रत्यक्ष</th>
                </tr>
              </thead>
              <tbody>
                {(kharchTree.get('root') || []).map((node) => (
                  <TreeRows key={node.id} node={node} byParent={kharchTree} depth={0}
                    edits={edits} onEdit={onEdit} canEdit={canEdit} printMode={false} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
