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

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');

// वृक्ष एका सपाट यादीत: गट = ठळक शीर्ष, leaf = "(१) नाव", गटानंतर "एकूण ..." ओळ - कागदी नमुना ३ प्रमाणे.
function flatten(node, byParent, depth, out, seq) {
  const children = byParent.get(node.id) || [];
  const amount = subtotal(node, byParent);
  if (node.is_leaf) {
    out.push({ kind: 'item', label: `${seq ? `(${mnum(seq)}) ` : ''}${node.name}`, amount, depth });
    return;
  }
  out.push({ kind: 'head', label: node.name, amount: null, depth });
  let n = 0;
  for (const c of children) flatten(c, byParent, depth + 1, out, c.is_leaf ? ++n : 0);
  out.push({ kind: 'total', label: `एकूण ${node.name}`, amount, depth });
}

function flatSide(byParent) {
  const out = [];
  for (const root of byParent.get('root') || []) flatten(root, byParent, 0, out, 0);
  return out;
}

const fmt = (n) => Number(n || 0).toFixed(2);

function cells(r, split) {
  const bold = !!r && r.kind !== 'item';
  const pad = r ? 6 + (r.kind === 'item' ? r.depth : Math.max(r.depth - 1, 0)) * 14 : 6;
  return [
    <td key="l" className={split ? 'an-split an-name' : 'an-name'} style={{ paddingLeft: pad, fontWeight: bold ? 700 : 400, textAlign: r && r.kind === 'total' ? 'right' : 'left' }}>{r ? r.label : ''}</td>,
    <td key="a" className="num" style={{ fontWeight: bold ? 700 : 400 }}>{r && r.amount !== null ? fmt(r.amount) : ''}</td>,
  ];
}

export default function AnnualSummaryReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
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
  const left = useMemo(() => flatSide(jamaTree), [jamaTree]);
  const right = useMemo(() => flatSide(kharchTree), [kharchTree]);
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

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="annual-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17 }}>नमुना - ३</div>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, margin: '4px 0' }}>
            सन <strong>{currentYear?.year_label || '.......'}</strong> या वर्षाचा जमा व खर्च ग्रामपंचायत {gpName || '.........'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '6px 0' }}>
            <span>{settings?.taluka ? `${settings.taluka} ` : '------------ '}पंचायत</span>
            <span>{settings?.district ? `${settings.district} ` : '------- '}जिल्हा</span>
          </div>
          <table className="an-table">
            <colgroup><col style={{ width: '37%' }} /><col style={{ width: '13%' }} /><col style={{ width: '37%' }} /><col style={{ width: '13%' }} /></colgroup>
            <thead>
              <tr><th>जमा रकमांचा तपशील</th><th>रक्कम</th><th className="an-split">खर्चाचा तपशील</th><th>रक्कम</th></tr>
              <tr className="an-numrow"><th>(१)</th><th>(२)</th><th className="an-split">(३)</th><th>(४)</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(left.length, right.length) }, (_, i) => {
                return <tr key={i}>{cells(left[i], false)}{cells(right[i], true)}</tr>;
              })}
              <tr className="an-grand">
                <td style={{ textAlign: 'right' }}>एकूण जमा</td><td className="num">{fmt(jamaTotal)}</td>
                <td className="an-split" style={{ textAlign: 'right' }}>एकूण खर्च</td><td className="num">{fmt(kharchTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
