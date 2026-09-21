import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// थकबाकी अहवाल: निवडलेल्या "चालू वर्षा"साठी घरपट्टी/दिवाबत्ती/आरोग्य कर/
// पाणीपट्टी/एकूण असा तपशील तीन गटांत दाखवला जातो -
//   जुनी      = त्या वर्षाआधीच्या सर्व वर्षांची बेरीज (प्रत्येक घटकानुसार)
//   नविन      = निवडलेल्या वर्षाचे आकडे
//   एकूण बाकी  = जुनी + नविन (प्रत्येक घटकानुसार)
// (या प्रणालीत भरणा/पावती नोंद नसल्याने "बाकी" म्हणजे एकूण आकारलेला कर.)
//
// कोड (मास्टर कोड) प्रमाणे एक मालक = एक ओळ: मालकाचे नाव वर आणि त्याखाली
// त्याच्या सर्व मालमत्ता क्रमांकांची यादी - एकाच स्तंभात, एकदाच. रकमा त्या
// मालकाच्या सर्व मालमत्तांची एकत्रित बेरीज असतात.
const COMPONENTS = [
  { key: 'gharpatti', label: 'घरपट्टी' },
  { key: 'divabatti', label: 'दिवाबत्ती' },
  { key: 'arogya', label: 'आरोग्य कर' },
  { key: 'panipatti', label: 'पाणीपट्टी' },
  { key: 'due', label: 'एकूण' },
];
const GROUPS = [
  { prefix: 'previous', label: 'जुनी' },
  { prefix: 'current', label: 'नविन' },
  { prefix: 'total', label: 'एकूण बाकी' },
  { prefix: 'collected', label: 'जमा' },
  { prefix: 'remaining', label: 'उर्वरित बाकी' },
];

function fieldName(prefix, componentKey) {
  if (componentKey === 'due') {
    if (prefix === 'collected') return 'collected_amount';
    if (prefix === 'remaining') return 'remaining_due';
    return `${prefix}_due`;
  }
  return `${prefix}_${componentKey}`;
}

function emptyTotals() {
  const t = {};
  for (const g of GROUPS) for (const c of COMPONENTS) t[fieldName(g.prefix, c.key)] = 0;
  return t;
}

export default function OldNewComparisonReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [year, setYear] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/old-new-comparison', { params: { yearId } })
      .then(({ data }) => { setYear(data.year); setRows(data.rows); })
      .finally(() => setLoading(false));
  }, [yearId]);

  const groups = useMemo(() => {
    const byCode = new Map();
    for (const r of rows) {
      const key = r.property_code ?? `__${r.property_id}`;
      if (!byCode.has(key)) {
        byCode.set(key, {
          property_code: r.property_code, owner_name: r.owner_name, malmataNos: [], sums: emptyTotals(),
        });
      }
      const g = byCode.get(key);
      if (r.malmata_no) g.malmataNos.push(r.malmata_no);
      for (const gr of GROUPS) for (const c of COMPONENTS) {
        const f = fieldName(gr.prefix, c.key);
        g.sums[f] += Number(r[f] || 0);
      }
    }
    return [...byCode.values()];
  }, [rows]);

  const grandTotals = useMemo(() => {
    const t = emptyTotals();
    for (const r of rows) {
      for (const gr of GROUPS) for (const c of COMPONENTS) {
        const f = fieldName(gr.prefix, c.key);
        t[f] += Number(r[f] || 0);
      }
    }
    return t;
  }, [rows]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>येणे बाकी अहवाल (जमा व उर्वरित)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>चालू वर्ष:</label>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_old_new', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>ग्रामपंचायत येणे बाकी अहवाल</h2>
        <p>चालू वर्ष: {year?.year_label || ''} (जुनी = या वर्षाआधीच्या सर्व वर्षांची बेरीज)</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>कोड</th>
                <th rowSpan={2} className="col-owner">मालकाचे नाव / मालमत्ता</th>
                {GROUPS.map((g) => <th key={g.prefix} colSpan={5}>{g.label}</th>)}
              </tr>
              <tr>
                {GROUPS.map((g) => COMPONENTS.map((c) => (
                  <th key={`${g.prefix}-${c.key}`} className="num">{c.label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.property_code ?? g.owner_name}>
                  <td>{g.property_code ?? '-'}</td>
                  <td className="col-owner">
                    <div className="owner-name">{g.owner_name}</div>
                    {g.malmataNos.length > 0 && (
                      <div className="owner-malmata">मालमत्ता क्र.: {g.malmataNos.join(', ')}</div>
                    )}
                  </td>
                  {GROUPS.map((gr) => COMPONENTS.map((c) => {
                    const f = fieldName(gr.prefix, c.key);
                    return (
                      <td key={f} className="num" style={gr.prefix === 'collected' ? { color: 'var(--success)' } : undefined}>
                        {g.sums[f].toFixed(2)}
                      </td>
                    );
                  }))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={27} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2}>एकूण</td>
                  {GROUPS.map((g) => COMPONENTS.map((c) => (
                    <td key={`${g.prefix}-${c.key}`} className="num">{grandTotals[fieldName(g.prefix, c.key)].toFixed(2)}</td>
                  )))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
