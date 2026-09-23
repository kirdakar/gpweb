import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना ३ - सन ___ चा जमा व खर्च. संपूर्ण लेखाशीर्ष वृक्षाची (जमा डावीकडे,
// खर्च उजवीकडे) त्या आर्थिक वर्षातील एकूण प्रत्यक्ष रक्कम - नमुना ६ प्रमाणेच
// cash_book_entries वरून काढलेला रिपोर्ट, फक्त संपूर्ण वर्ष + संपूर्ण वृक्ष.
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

// leaf नसलेल्या शीर्षांसाठी त्याच्या सर्व leaf वंशजांची बेरीज (गट-एकूण).
function subtotal(node, byParent) {
  if (node.is_leaf) return Number(node.amount);
  const children = byParent.get(node.id) || [];
  return children.reduce((s, c) => s + subtotal(c, byParent), 0);
}

function TreeRows({ node, byParent, depth }) {
  const children = byParent.get(node.id) || [];
  const amount = subtotal(node, byParent);
  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{node.code}</td>
        <td style={{ paddingLeft: 12 + depth * 18 }}>
          <span style={{ fontWeight: node.is_leaf ? 400 : 700 }}>{node.name}</span>
        </td>
        <td className="num" style={{ fontWeight: node.is_leaf ? 400 : 700 }}>{amount.toFixed(2)}</td>
      </tr>
      {children.map((child) => <TreeRows key={child.id} node={child} byParent={byParent} depth={depth + 1} />)}
    </>
  );
}

export default function AnnualSummaryReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/annual-summary', { params: { financialYearId: yearId } })
      .then(({ data }) => setHeads(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const jamaTree = useMemo(() => buildTree(heads.filter((h) => h.group_type === 'जमा')), [heads]);
  const kharchTree = useMemo(() => buildTree(heads.filter((h) => h.group_type === 'खर्च')), [heads]);
  const jamaTotal = useMemo(() => (jamaTree.get('root') || []).reduce((s, n) => s + subtotal(n, jamaTree), 0), [jamaTree]);
  const kharchTotal = useMemo(() => (kharchTree.get('root') || []).reduce((s, n) => s + subtotal(n, kharchTree), 0), [kharchTree]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वार्षिक जमा-खर्च (नमुना ३) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_annual_summary', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>सन {currentYear?.year_label || ''} चा जमा व खर्च (नमुना ३)</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <h3 style={{ color: '#1d4ed8' }}>जमा तपशील</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>कोड</th><th>जमा तपशील</th><th className="num">रक्कम</th></tr></thead>
                <tbody>
                  {(jamaTree.get('root') || []).map((n) => <TreeRows key={n.id} node={n} byParent={jamaTree} depth={0} />)}
                </tbody>
                <tfoot>
                  <tr className="total-row"><td colSpan={2}>एकूण जमा</td><td className="num">{jamaTotal.toFixed(2)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div>
            <h3 style={{ color: '#dc2626' }}>खर्चाचा तपशील</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>कोड</th><th>खर्चाचा तपशील</th><th className="num">रक्कम</th></tr></thead>
                <tbody>
                  {(kharchTree.get('root') || []).map((n) => <TreeRows key={n.id} node={n} byParent={kharchTree} depth={0} />)}
                </tbody>
                <tfoot>
                  <tr className="total-row"><td colSpan={2}>एकूण खर्च</td><td className="num">{kharchTotal.toFixed(2)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
