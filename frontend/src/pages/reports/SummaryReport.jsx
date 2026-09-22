import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// नमुना नं. ८ आकारणी यादी घोषवारा - बांधकाम प्रकारानुसार (दर मास्टर
// क्रमाने) गट करून संख्या/क्षेत्रफळ/कर एकत्रित बेरीज दाखवणारा जुन्या
// कागदी अहवालाशी जुळणारा घोषवारा (मालकनिहाय सारांश ऐवजी).
export default function SummaryReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ gp_name: '', taluka: '', district: '' });
  const [periodText, setPeriodText] = useState('');

  useEffect(() => {
    client.get('/settings').then(({ data }) => setSettings(data));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    const label = years.find((y) => y.id === yearId)?.year_label;
    if (label) setPeriodText(label);
  }, [yearId, years]);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/summary', { params: { yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const gpLine = [settings.gp_name, settings.taluka ? `ता. ${settings.taluka}` : '', settings.district ? `जि. ${settings.district}` : '']
    .filter(Boolean).join(' ') || '(ग्रामपंचायतीचे नाव सेटिंग्जमध्ये नोंदवा)';

  const totals = rows.reduce((acc, r) => {
    acc.property_count += Number(r.property_count || 0);
    acc.area_sqft += Number(r.area_sqft || 0);
    acc.area_sqm += Number(r.area_sqm || 0);
    acc.gharpatti += Number(r.gharpatti || 0);
    acc.divabatti += Number(r.divabatti || 0);
    acc.arogya += Number(r.arogya || 0);
    acc.panipatti += Number(r.panipatti || 0);
    acc.total_tax += Number(r.total_tax || 0);
    return acc;
  }, { property_count: 0, area_sqft: 0, area_sqm: 0, gharpatti: 0, divabatti: 0, arogya: 0, panipatti: 0, total_tax: 0 });

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>सारांश (आकारणी यादी घोषवारा)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          <input style={{ width: 160, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
            value={periodText} onChange={(e) => setPeriodText(e.target.value)} placeholder="कालावधी उदा. 2025-26 ते 2028-29" />
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_summary', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <p style={{ margin: '0 0 2px', fontSize: 15 }}>नमुना नं. ८ कारास पात्र असलेल्या इमारती व जमिनी यांची सन {periodText} साठी</p>
        <h2 style={{ margin: '0 0 4px' }}>{gpLine}</h2>
        <p style={{ margin: 0, fontWeight: 700 }}>आकारणी यादी घोषवारा</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>अ.क्र.</th><th>मालमत्तेचे वर्णन</th><th className="num">संख्या</th>
                <th className="num">क्षेत्रफळ चौ.फू.</th><th className="num">क्षेत्रफळ चौ.मी.</th>
                <th className="num">घरपट्टी कर</th><th className="num">दिवाबत्ती कर</th>
                <th className="num">आरोग्य कर</th><th className="num">पाणीपट्टी कर</th><th className="num">एकूण</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.par_code ?? `__${i}`}>
                  <td>{i + 1}</td>
                  <td>{r.description || (r.par_code == null ? 'अनिर्दिष्ट' : '-')}</td>
                  <td className="num">{r.property_count}</td>
                  <td className="num">{Number(r.area_sqft || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.area_sqm || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.gharpatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.divabatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.arogya || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.panipatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.total_tax || 0).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2}>एकूण</td>
                  <td className="num">{totals.property_count}</td>
                  <td className="num">{totals.area_sqft.toFixed(2)}</td>
                  <td className="num">{totals.area_sqm.toFixed(2)}</td>
                  <td className="num">{totals.gharpatti.toFixed(2)}</td>
                  <td className="num">{totals.divabatti.toFixed(2)}</td>
                  <td className="num">{totals.arogya.toFixed(2)}</td>
                  <td className="num">{totals.panipatti.toFixed(2)}</td>
                  <td className="num">{totals.total_tax.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
