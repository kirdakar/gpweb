import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना १ - वार्षिक अंदाजपत्रक अहवाल (प्रिंट). डाटाएंट्री BudgetEntry.jsx
// (दैनिक व्यवहार) वर; हे फक्त वाचनीय, सर्व ५ कागदी कॉलम दाखवणारे स्वरूप.
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

function TreeRows({ node, byParent, depth }) {
  const children = byParent.get(node.id) || [];
  const bold = node.is_leaf ? 400 : 700;
  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{node.code}</td>
        <td style={{ paddingLeft: 12 + depth * 18 }}><span style={{ fontWeight: bold }}>{node.name}</span></td>
        <td className="num">{Number(node.proposed_amount).toFixed(2)}</td>
        <td className="num">{Number(node.approved_amount).toFixed(2)}</td>
        <td className="num">{Number(node.previous_year_actual).toFixed(2)}</td>
        <td className="num">{Number(node.year_before_previous_actual).toFixed(2)}</td>
      </tr>
      {children.map((child) => <TreeRows key={child.id} node={child} byParent={byParent} depth={depth + 1} />)}
    </>
  );
}

export default function BudgetReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/budget-entries', { params: { financialYearId: yearId } })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const jamaTree = useMemo(() => buildTree((data?.heads || []).filter((h) => h.group_type === 'जमा')), [data]);
  const kharchTree = useMemo(() => buildTree((data?.heads || []).filter((h) => h.group_type === 'खर्च')), [data]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वार्षिक अंदाजपत्रक अहवाल (नमुना १) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!data || !can('reports_budget', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

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
                {(jamaTree.get('root') || []).map((node) => <TreeRows key={node.id} node={node} byParent={jamaTree} depth={0} />)}
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
                {(kharchTree.get('root') || []).map((node) => <TreeRows key={node.id} node={node} byParent={kharchTree} depth={0} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
