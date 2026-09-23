import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  '१ जानेवारी', '२ फेब्रुवारी', '३ मार्च', '४ एप्रिल', '५ मे', '६ जून',
  '७ जुलै', '८ ऑगस्ट', '९ सप्टेंबर', '१० ऑक्टोबर', '११ नोव्हेंबर', '१२ डिसेंबर',
];

// नमुना २६-क - माह ___ वर्ष ___ चे जमा व खर्चाचे मासिक विवरण. संपूर्ण
// वृक्षासाठी अर्थसंकल्पीय तरतूद + मागील महिन्यापर्यंत + चालू महिना + एकूण.
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

function subtotalOf(node, byParent, field) {
  if (node.is_leaf) return Number(node[field] || 0);
  const children = byParent.get(node.id) || [];
  return children.reduce((s, c) => s + subtotalOf(c, byParent, field), 0);
}

function TreeRows({ node, byParent, depth }) {
  const children = byParent.get(node.id) || [];
  const budget = subtotalOf(node, byParent, 'approved_amount');
  const prior = subtotalOf(node, byParent, 'prior_total');
  const current = subtotalOf(node, byParent, 'current_total');
  const total = subtotalOf(node, byParent, 'total');
  const bold = node.is_leaf ? 400 : 700;
  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{node.code}</td>
        <td style={{ paddingLeft: 12 + depth * 18 }}><span style={{ fontWeight: bold }}>{node.name}</span></td>
        <td className="num" style={{ fontWeight: bold }}>{budget.toFixed(2)}</td>
        <td className="num" style={{ fontWeight: bold }}>{prior.toFixed(2)}</td>
        <td className="num" style={{ fontWeight: bold }}>{current.toFixed(2)}</td>
        <td className="num" style={{ fontWeight: bold }}>{total.toFixed(2)}</td>
      </tr>
      {children.map((child) => <TreeRows key={child.id} node={child} byParent={byParent} depth={depth + 1} />)}
    </>
  );
}

export default function MonthlyStatementReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/monthly-statement', { params: { financialYearId: yearId, year, month } })
      .then(({ data }) => setHeads(data.heads))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const jamaTree = useMemo(() => buildTree(heads.filter((h) => h.group_type === 'जमा')), [heads]);
  const kharchTree = useMemo(() => buildTree(heads.filter((h) => h.group_type === 'खर्च')), [heads]);

  function Table({ title, tree }) {
    const roots = tree.get('root') || [];
    return (
      <div style={{ marginBottom: 24 }}>
        <h3>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>कोड</th><th>शीर्ष</th><th className="num">अर्थसंकल्पीय तरतूद</th>
                <th className="num">मागील महिन्यापर्यंत</th><th className="num">चालू महिना</th><th className="num">एकूण</th>
              </tr>
            </thead>
            <tbody>
              {roots.map((n) => <TreeRows key={n.id} node={n} byParent={tree} depth={0} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक जमा-खर्च विवरण (नमुना २६-क)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={heads.length === 0 || !can('reports_monthly_statement', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <button className="btn secondary" type="button" onClick={load}>दाखवा</button>
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>मासिक जमा-खर्च विवरण (नमुना २६-क)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''} | महिना: {MONTHS[month - 1]} {year}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <Table title="जमा शीर्ष" tree={jamaTree} />
          <Table title="खर्च शीर्ष" tree={kharchTree} />
        </>
      )}
    </div>
  );
}
