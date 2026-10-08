import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const cell = (n) => (Number(n) ? Number(n).toFixed(2) : '');
const WIDTHS = [20, 7.5, 7.5, 7.5, 7.5, 20, 7.5, 7.5, 7.5, 7.5];
const FIELDS = ['approved_amount', 'prior_total', 'current_total', 'total'];

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

// गटातील सर्व leaf वंशजांची बेरीज (प्रत्येक रकान्यासाठी).
function sums(node, byParent) {
  if (node.is_leaf) return FIELDS.map((f) => Number(node[f] || 0));
  const acc = [0, 0, 0, 0];
  for (const c of byParent.get(node.id) || []) sums(c, byParent).forEach((v, i) => { acc[i] += v; });
  return acc;
}

// गटांच्या "एकूण" ओळींची नावे कागदी नमुना २६-ख प्रमाणे (शीर्ष कोडनुसार); नसेल तर "एकूण <नाव>".
const TOTAL_LABELS = {
  '1.a': 'एकूण (एक) (अ) कर', '1.b': 'एकूण (एक) (ब) करेतर उत्पन्न', '1.c': 'एकूण (एक) (क)', 1: 'एकूण (एक) (अ+ब+क)',
  '2.a': 'एकूण दोन (अ)', 2: 'एकूण (दोन) (अ+ब)', 3: 'एकूण (तीन)', 4: 'एकूण (चार)', 5: 'एकूण (पाच)', 6: 'एकूण (सहा)',
  K1: 'एकूण (एक) ग्राम निधी', K2: 'एकूण (दोन)', K3: 'एकूण (तीन)', K4: 'एकूण (चार)', K5: 'एकूण (पाच)', K6: 'एकूण (सहा)',
};
const GRAND_LABEL = 'एकूण (एक)+(दोन)+(तीन)+(चार)+(पाच)+(सहा)';

// वृक्ष एका सपाट यादीत: गट = ठळक शीर्ष, leaf = "(१) नाव" + रकमा, गटानंतर "एकूण ..." ओळ - कागदी नमुना २६-ख प्रमाणे.
function flatten(node, byParent, depth, out, seq) {
  const children = byParent.get(node.id) || [];
  if (node.is_leaf) {
    out.push({ kind: 'item', label: `${seq ? `(${mnum(seq)}) ` : ''}${node.name}`, vals: sums(node, byParent), depth });
    return;
  }
  out.push({ kind: 'head', label: node.name, vals: null, depth });
  let n = 0;
  for (const c of children) {
    if (c.code === 'K1.11') continue; // K1.10 सोबत "विद्युत देयके (अ)/(ब)" म्हणून खाली छापले
    if (c.code === 'K1.10') {
      // कागदावर (१०) विद्युत देयके - (अ) पाणीपुरवठा, (ब) रस्त्यावरील दिवाबत्ती - एकूण १० (अ+ब)
      const other = children.find((x) => x.code === 'K1.11');
      const a = sums(c, byParent);
      const b = other ? sums(other, byParent) : [0, 0, 0, 0];
      out.push({ kind: 'head', label: `(${mnum(++n)}) विद्युत देयके`, vals: null, depth: depth + 1 });
      out.push({ kind: 'item', label: '(अ) पाणीपुरवठा', vals: a, depth: depth + 2 });
      out.push({ kind: 'item', label: '(ब) रस्त्यावरील दिवाबत्ती', vals: b, depth: depth + 2 });
      out.push({ kind: 'total', label: 'एकूण १० (अ+ब)', vals: a.map((v, i) => v + b[i]), depth: depth + 1 });
      continue;
    }
    // "(दोन) (ब) आमदार, खासदार..." कागदावर क्रमांकाशिवाय
    flatten(c, byParent, depth + 1, out, c.is_leaf && c.code !== '2.b' ? ++n : 0);
    // कागदी नमुन्यात (९) जकात कर ही ओळ आहे (शीर्ष यादीत नाही) - रिकामी ओळ म्हणून, टोल टॅक्स नंतर
    if (c.code === '1.a.8') out.push({ kind: 'item', label: `(${mnum(++n)}) जकात कर`, vals: [0, 0, 0, 0], depth: depth + 1 });
  }
  out.push({ kind: 'total', label: TOTAL_LABELS[node.code] || `एकूण ${node.name}`, vals: sums(node, byParent), depth });
}
function flatSide(byParent) {
  const out = [];
  for (const root of byParent.get('root') || []) flatten(root, byParent, 0, out, 0);
  return out;
}

function cells(r, split) {
  const bold = !!r && r.kind !== 'item';
  const pad = r ? 6 + (r.kind === 'item' ? r.depth : Math.max(r.depth - 1, 0)) * 12 : 6;
  const out = [
    <td key="l" className={split ? 'cb-split cb-name' : 'cb-name'} style={{ paddingLeft: pad, fontWeight: bold ? 700 : 400, textAlign: r && r.kind === 'total' ? 'right' : 'left' }}>{r ? r.label : ''}</td>,
  ];
  for (let i = 0; i < 4; i += 1) {
    const v = r && r.vals ? r.vals[i] : null;
    out.push(<td key={i} className="num" style={{ fontWeight: bold ? 700 : 400 }}>{v == null ? '' : (r.kind === 'item' ? cell(v) : fmt(v))}</td>);
  }
  return out;
}

// नमुना २६-ख (नियम २५(६) पाहा) - माहे ___ वर्ष ___ साठीचे जमा व खर्चाचे मासिक विवरण, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर: जमा (१-५)
// व खर्च (६-१०) समोरासमोर एकाच तक्त्यात - अर्थसंकल्पीय तरतूद, मागील महिन्यापर्यंतचा प्रत्यक्ष, चालू महिन्यातील, एकूण. सर्व रकमा नमुना १
// (अर्थसंकल्प) व नमुना ५ (रोकड वही) वरून आपोआप.
export default function MonthlyStatementReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

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
  useEffect(() => { load(); }, [yearId, year, month]);

  const left = useMemo(() => flatSide(buildTree(heads.filter((h) => h.group_type === 'जमा'))), [heads]);
  const right = useMemo(() => flatSide(buildTree(heads.filter((h) => h.group_type === 'खर्च'))), [heads]);
  const grand = (rows) => rows.filter((r) => r.kind === 'total' && r.depth === 0).reduce((acc, r) => acc.map((v, i) => v + r.vals[i]), [0, 0, 0, 0]);
  const jt = useMemo(() => grand(left), [left]);
  const kt = useMemo(() => grand(right), [right]);
  const count = Math.max(left.length, right.length);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक जमा-खर्च विवरण (नमुना २६-ख)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={heads.length === 0 || !can('reports_monthly_statement', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २६-ख</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम २५(६) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0' }}>
            माहे <strong>{MONTHS[month - 1]}</strong> वर्ष <strong>{currentYear?.year_label || year}</strong> साठीचे जमा व खर्चाचे मासिक विवरण
          </div>
          <div style={{ fontSize: 13, margin: '4px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr><th colSpan={5}>जमा</th><th colSpan={5} className="cb-split">खर्च</th></tr>
                <tr>
                  <th>जमेचा प्रमुख प्रकार</th><th>अर्थसंकल्पीय तरतूद</th><th>मागील महिन्यापर्यंतचा प्रत्यक्ष जमा</th><th>चालू महिन्यातील जमा</th><th>एकूण जमा</th>
                  <th className="cb-split">खर्चाचा प्रमुख प्रकार</th><th>अर्थसंकल्पीय तरतूद</th><th>मागील महिन्यापर्यंत झालेला प्रत्यक्ष खर्च</th><th>चालू महिन्यात झालेला खर्च</th><th>एकूण</th>
                </tr>
                <tr className="cb-numrow">{Array.from({ length: 10 }, (_, i) => <th key={i} className={i === 5 ? 'cb-split' : ''}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: count }, (_, i) => {
                  return <tr key={i}>{cells(left[i], false)}{cells(right[i], true)}</tr>;
                })}
                <tr className="cb-total">
                  <td style={{ textAlign: 'right' }}>{GRAND_LABEL}</td>{jt.map((v, i) => <td key={i} className="num">{fmt(v)}</td>)}
                  <td className="cb-split" style={{ textAlign: 'right' }}>{GRAND_LABEL}</td>{kt.map((v, i) => <td key={i} className="num">{fmt(v)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
