import { Fragment, useEffect, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import useGpSettings from '../hooks/useGpSettings';

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
  const { settings } = useGpSettings();
  const gpShort = (settings.gp_name || '').replace(/^ग्रामपंचायत\s*/, '') || 'ग्रामपंचायत';
  // गावाच्या नावाचा आकार लांबीनुसार, जेणेकरून टाकीत मावेल
  const nameSize = Math.max(14, Math.min(32, 175 / (Math.max(gpShort.length, 5) * 0.62)));
  const [oldNewRows, setOldNewRows] = useState([]);
  const [propertyCount, setPropertyCount] = useState(null);
  const [loading, setLoading] = useState(true);
  // सविस्तर टेबल सुरुवातीस लपवलेले - "डॅशबोर्ड" शीर्षकावर क्लिक केल्यावर दिसते/लपते
  const [showDetails, setShowDetails] = useState(false);

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
  // व्यक्ती संख्या = त्या रकान्यात रक्कम > 0 असलेले वेगळे मिळकत कोड (एक कोड = एक व्यक्ती).
  function countField(field) {
    const codes = new Set();
    for (const r of oldNewRows) if (Number(r[field] || 0) > 0) codes.add(r.property_code ?? `__${r.property_id}`);
    return codes.size;
  }

  const big = { fontSize: 20, fontWeight: 700 };
  const head = { fontSize: 19, fontWeight: 800 };

  return (
    <div className="page dashboard-page">
      {/* पार्श्वभूमी चित्र + पाण्याच्या टाकीवर ग्रामपंचायतीचे नाव: चित्र व नाव एकाच SVG मध्ये
          (समान preserveAspectRatio) म्हणून कोणत्याही स्क्रीन आकारात नाव टाकीवरच राहते. */}
      <svg className="dashboard-scene no-print" viewBox="0 100 1600 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <image href="/gp-bg.svg" x="0" y="0" width="1600" height="900" preserveAspectRatio="xMidYMin slice" />
        {/* टाकीवर गावाचे नाव */}
        <text x="800" y="343" textAnchor="middle" fontSize={nameSize} fontWeight="800" fill="#ffffff">{gpShort}</text>
        {/* पूर्वीच्या "+" चिन्हाच्या जागी (त्रिकोणी भागात) "ग्रामपंचायत" */}
        <text x="800" y="438" textAnchor="middle" fontSize="25" fontWeight="800" fill="#123a6b">ग्रामपंचायत</text>
      </svg>
      <div className="page-header" style={{ justifyContent: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
        <h1
          role="button" tabIndex={0} title={showDetails ? 'सविस्तर माहिती लपवा' : 'सविस्तर माहिती पहा'}
          onClick={() => setShowDetails((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDetails((v) => !v); }}
          style={{ fontSize: 28, fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
        >
          डॅशबोर्ड {currentYear ? `— ${currentYear.year_label}` : ''} <span style={{ fontSize: 20 }}>{showDetails ? '▲' : '▼'}</span>
        </h1>
        {!loading && (
          <div className="card" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 18px', borderTop: '3px solid #1d4ed8' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>एकूण मिळकती</span>
            <span style={{ fontSize: 30, fontWeight: 800 }}>{propertyCount ?? '-'}</span>
          </div>
        )}
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          {showDetails && <div className="table-wrap" onClick={() => setShowDetails(false)} title="लपवण्यासाठी टेबलवर क्लिक करा" style={{ cursor: 'pointer' }}>
            <table>
              <thead>
                <tr>
                  <th rowSpan={2} style={head}>हेड</th>
                  {COLUMNS.map((c) => <th key={c.key} colSpan={2} className="num" style={{ ...head, color: c.color, textAlign: 'center', borderBottom: `2px solid ${c.color}` }}>{c.label}</th>)}
                </tr>
                <tr>
                  {COLUMNS.map((c) => (
                    <Fragment key={c.key}>
                      <th className="num" style={{ ...head, fontSize: 16, color: c.color }}>व्यक्ती</th>
                      <th className="num" style={{ ...head, fontSize: 16, color: c.color }}>रक्कम</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key}>
                    <td style={big}>{r.label}</td>
                    {COLUMNS.map((c) => (
                      <Fragment key={c.key}>
                        <td className="num" style={big}>{countField(`${c.key}_${r.key}`)}</td>
                        <td className="num" style={big}>{sumField(`${c.key}_${r.key}`).toFixed(2)}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td style={big}>एकूण</td>
                  {COLUMNS.map((c) => (
                    <Fragment key={c.key}>
                      <td className="num" style={{ ...big, fontSize: 22, color: c.color }}>{countField(c.totalField)}</td>
                      <td className="num" style={{ ...big, fontSize: 22, color: c.color }}>{sumField(c.totalField).toFixed(2)}</td>
                    </Fragment>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>}
        </>
      )}
    </div>
  );
}
