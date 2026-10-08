import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const WIDTHS = [4, 15, 12, 7, 8, 7, 12, 10, 10, 8, 7, 7];

// मराठी/इंग्रजी अंकांतून पहिली संख्या ("२ नग" -> 2); नसेल तर null.
function toNum(s) {
  if (s == null) return null;
  const ascii = String(s).replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
  const m = /\d+(\.\d+)?/.exec(ascii);
  return m ? Number(m[0]) : null;
}

// साठ्यातील शिल्लक (रु.): खरेदी व विल्हेवाट दोन्हीची संख्या अंकात असेल तर किंमत × उरलेली संख्या ÷ खरेदीची संख्या;
// विल्हेवाट नसेल तर पूर्ण किंमत; अन्यथा रिकामे (हाताने लिहायला).
function balance(r) {
  const hasDisposal = r.disposal_date || r.disposal_quantity || r.disposal_details;
  if (!hasDisposal) return Number(r.cost_amount);
  const q = toNum(r.quantity_or_measure);
  const dq = toNum(r.disposal_quantity);
  if (q && dq != null && dq <= q) return (Number(r.cost_amount) * (q - dq)) / q;
  return null;
}

// नमुना १६ (नियम ४७(५) पाहा) - जडवस्तू संग्रह किंवा जंगम मालमत्ता नोंदवहीचा नमुना, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर
// १२ रकान्यांसह. डाटाएंट्री MovableAssetEntry.jsx वर; इथे फक्त छापील रूप. आद्याक्षरीचे दोन्ही रकाने हाताने सही करण्यासाठी रिकामे.
export default function MovableAssetsReport() {
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/fixed-assets', { params: { category: 'जंगम' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.cost_amount || 0), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>जंगम मालमत्ता अहवाल (नमुना १६)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_fixed_assets', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना १६</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम ४७(५) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0' }}>जडवस्तू संग्रह किंवा जंगम मालमत्ता नोंदवहीचा नमुना</div>
          <div style={{ fontSize: 13, margin: '4px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>अ. क्र.</th>
                  <th rowSpan={2}>वस्तूचे वर्णन</th>
                  <th rowSpan={2}>खरेदीचे प्राधिकार व खरेदीची तारीख</th>
                  <th rowSpan={2}>संख्या किंवा परिमाण</th>
                  <th rowSpan={2}>किंमत (रु. पै.)</th>
                  <th rowSpan={2}>सरपंचाची/ सचिवाची आद्याक्षरी</th>
                  <th colSpan={2}>अंतिम विल्हेवाट</th>
                  <th rowSpan={2}>वसूल केलेली रक्कम व ती कोषागारात भरल्याची तारीख</th>
                  <th rowSpan={2}>साठ्यातील शिल्लक (रु. पै.)</th>
                  <th rowSpan={2}>सरपंचाची/ सचिवाची आद्याक्षरी</th>
                  <th rowSpan={2}>शेरा</th>
                </tr>
                <tr>
                  <th>संख्या किंवा परिमाण विल्हेवाटीचे स्वरूप</th>
                  <th>प्राधिकार पत्र किंवा प्रमाणक</th>
                </tr>
                <tr className="cb-numrow">{Array.from({ length: 12 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: 'center', padding: 14 }}>अद्याप नोंद नाही</td></tr>}
                {rows.map((r, i) => {
                  const bal = balance(r);
                  return (
                    <tr key={r.id} style={{ height: 36 }}>
                      <td className="num">{mnum(i + 1)}</td>
                      <td>{r.description}</td>
                      <td>{[r.acquired_mode, r.acquired_date ? fmtDate(r.acquired_date) : ''].filter(Boolean).join(' / ')}</td>
                      <td>{r.quantity_or_measure || ''}</td>
                      <td className="num">{fmt(r.cost_amount)}</td>
                      <td />
                      <td>{[r.disposal_quantity, r.disposal_details].filter(Boolean).join(' - ')}</td>
                      <td>{[r.disposal_authority, r.disposal_date ? fmtDate(r.disposal_date) : ''].filter(Boolean).join(' / ')}</td>
                      <td>{r.recovered_amount != null ? `${fmt(r.recovered_amount)}${r.recovered_deposit_date ? ` / ${fmtDate(r.recovered_deposit_date)}` : ''}` : ''}</td>
                      <td className="num">{bal == null ? '' : fmt(bal)}</td>
                      <td />
                      <td>{r.remark || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="cb-total">
                    <td colSpan={4} style={{ textAlign: 'right' }}>एकूण किंमत</td>
                    <td className="num">{fmt(total)}</td>
                    <td colSpan={7} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
