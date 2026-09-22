import { useEffect, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';

// मागील बाकी, चालू बाकी, एकूण बाकी, जमा, उर्वरित बाकी - हे ५ गट एकाच
// कॉम्पॅक्ट टेबलमध्ये (येणे बाकी अहवालाच्याच आकडेवारीवरून, पहा
// reports.routes.js /old-new-comparison) जेणेकरून सर्व एका स्क्रीनवर
// (स्क्रोलशिवाय) मावतील - आधीचे ३ मोठे स्टॅट-कार्ड गट खूप उंच होत होते.
const COLUMNS = [
  { key: 'previous', label: 'मागील बाकी', color: '#b45309', totalField: 'previous_due' },
  { key: 'current', label: 'चालू बाकी', color: '#1d4ed8', totalField: 'current_due' },
  { key: 'total', label: 'एकूण बाकी', color: '#6d28d9', totalField: 'total_due' },
  { key: 'collected', label: 'जमा', color: '#15803d', totalField: 'collected_amount' },
  { key: 'remaining', label: 'उर्वरित बाकी', color: '#dc2626', totalField: 'remaining_due' },
];
const ROWS = [
  { key: 'gharpatti', label: 'घरपट्टी' },
  { key: 'divabatti', label: 'दिवाबत्ती' },
  { key: 'arogya', label: 'आरोग्य कर' },
  { key: 'panipatti', label: 'पाणीपट्टी' },
];

export default function Dashboard() {
  const { yearId, currentYear } = useYear();
  const [oldNewRows, setOldNewRows] = useState([]);
  const [propertyCount, setPropertyCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      client.get('/reports/old-new-comparison', { params: { yearId } }),
      client.get('/properties', { params: { page: 1, pageSize: 1 } }),
    ]).then(([oldNewRes, propRes]) => {
      if (cancelled) return;
      setOldNewRows(oldNewRes.data.rows);
      setPropertyCount(propRes.data.total);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [yearId]);

  function sumField(field) {
    return oldNewRows.reduce((s, r) => s + Number(r[field] || 0), 0);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>डॅशबोर्ड {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <div className="card" style={{ display: 'inline-block', marginBottom: 16, borderTop: '3px solid #1d4ed8' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>एकूण मिळकती</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{propertyCount ?? '-'}</div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>हेड</th>
                  {COLUMNS.map((c) => <th key={c.key} className="num" style={{ color: c.color }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="num">{sumField(`${c.key}_${r.key}`).toFixed(2)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td>एकूण</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="num" style={{ color: c.color }}>{sumField(c.totalField).toFixed(2)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
