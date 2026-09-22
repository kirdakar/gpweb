import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// थकबाकी अहवाल: निवडलेल्या "चालू वर्षा"साठी घरपट्टी/दिवाबत्ती/आरोग्य कर/
// पाणीपट्टी/एकूण असा तपशील तीन गटांत दाखवला जातो -
//   जुनी      = त्या वर्षाआधीच्या सर्व वर्षांची बेरीज (प्रत्येक घटकानुसार)
//   नविन      = निवडलेल्या वर्षाचे आकडे
//   एकूण बाकी  = जुनी + नविन (प्रत्येक घटकानुसार)
// (या प्रणालीत भरणा/पावती नोंद नसल्याने "बाकी" म्हणजे एकूण आकारलेला कर.)
//
// कोड (मास्टर कोड) प्रमाणे एक मालक = एक ओळ: मालकाचे नाव वर आणि त्याखाली
// त्याच्या सर्व मालमत्ता क्रमांकांची यादी - एकाच स्तंभात, एकदाच. रकमा त्या
// मालकाच्या सर्व मालमत्तांची एकत्रित बेरीज असतात. नावानंतर फक्त एकूण
// रकमा (घरपट्टी/दिवाबत्ती/आरोग्य/पाणीपट्टी हेडवार फोड न दाखवता) - तो तपशील
// हवा असल्यास कर जमा भरणे स्क्रीनवरील "तपशील" बटणातून मिळतो.
const GROUPS = [
  { field: 'previous_due', label: 'मागील बाकी' },
  { field: 'current_due', label: 'चालू वर्ष बाकी' },
  { field: 'total_due', label: 'एकूण बाकी' },
  { field: 'collected_amount', label: 'जमा' },
  { field: 'remaining_due', label: 'उर्वरित बाकी' },
];

function emptyTotals() {
  const t = {};
  for (const g of GROUPS) t[g.field] = 0;
  return t;
}

export default function OldNewComparisonReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
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
      for (const gr of GROUPS) g.sums[gr.field] += Number(r[gr.field] || 0);
    }
    return [...byCode.values()];
  }, [rows]);

  const grandTotals = useMemo(() => {
    const t = emptyTotals();
    for (const r of rows) for (const gr of GROUPS) t[gr.field] += Number(r[gr.field] || 0);
    return t;
  }, [rows]);

  return (
    <div className="page old-new-report">
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
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>येणे बाकी अहवाल (जमा व उर्वरित)</p>
        <p>चालू वर्ष: {year?.year_label || ''} (जुनी = या वर्षाआधीच्या सर्व वर्षांची बेरीज)</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table className="old-new-table">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13.4%' }} />
              <col style={{ width: '13.4%' }} />
              <col style={{ width: '13.4%' }} />
              <col style={{ width: '13.4%' }} />
              <col style={{ width: '13.4%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>कोड</th>
                <th className="col-owner-name">मालकाचे नाव</th>
                <th className="col-malmata">मिळकत क्रं.</th>
                {GROUPS.map((g) => <th key={g.field} className="num">{g.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.property_code ?? g.owner_name}>
                  <td>{g.property_code ?? '-'}</td>
                  <td className="col-owner-name">{g.owner_name}</td>
                  <td className="col-malmata">{g.malmataNos.join(', ')}</td>
                  {GROUPS.map((gr) => (
                    <td key={gr.field} className="num" style={gr.field === 'collected_amount' ? { color: 'var(--success)' } : undefined}>
                      {g.sums[gr.field].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={3}>एकूण</td>
                  {GROUPS.map((g) => (
                    <td key={g.field} className="num">{grandTotals[g.field].toFixed(2)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
