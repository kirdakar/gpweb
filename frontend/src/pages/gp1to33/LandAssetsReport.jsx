import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const PER_PAGE = 4;
const W1 = [4, 9, 11, 12, 13, 9, 11, 9, 22];
const W2 = [4, 18, 16, 10, 12, 14, 14, 12];

// नमुना २४ (नियम ६९ पाहा) - जमिनीची नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते (१: अनुक्रमांक, तारीख, कारण, कोणाकडून,
// करारनामा/निवाडा निर्देश, क्षेत्रफळ, भूमापन क्रमांक, आकारणी, सीमा; २: जमिनीसह इमारती, विल्हेवाट, विक्रीची रक्कम, प्रमाणक, ठराव, कलम ५५
// आदेश, शेरा). डाटाएंट्री LandAssetEntry.jsx वर. जमिनीची किंमत कागदी नमुन्यात नाही - ती फक्त नमुना ४ साठी, इथे छापली जात नाही.
export default function LandAssetsReport() {
  const { currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/fixed-assets', { params: { category: 'जमीन' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>जमिनींचा अहवाल (नमुना २४)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_fixed_assets', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>अद्याप नोंद नाही.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २४</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम ६९ पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>जमिनीची नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>
            ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; गट : {settings?.taluka ? <strong>{settings.taluka}</strong> : '----------'} &nbsp; जिल्हा : {settings?.district ? <strong>{settings.district}</strong> : '----------'}
            &nbsp; (सन {currentYear?.year_label})
          </div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>अनुक्रमांक</th><th>हस्तांतरित, खरेदी किंवा संपादित केल्याची तारीख</th><th>कोणत्या कारणासाठी</th><th>कोणाकडून</th>
                <th>करारनामा, निवाडा इत्यादींचा निर्देश</th><th>जमिनीचे क्षेत्रफळ</th><th>भूमापन क्रमांक इत्यादी</th><th>आकारणी</th><th>जमिनीची सीमा</th>
              </tr>
              <tr className="cl-numrow">{Array.from({ length: 9 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td>{r.acquired_date ? fmtDate(r.acquired_date) : ''}</td>
                  <td className="cl-name">{r.purpose || ''}</td>
                  <td className="cl-name">{r.acquired_from || ''}</td>
                  <td className="cl-name">{r.acquired_mode || ''}</td>
                  <td className="cl-name">{r.quantity_or_measure || ''}</td>
                  <td className="cl-name">{[r.survey_no, r.description].filter(Boolean).join(' - ')}</td>
                  <td className="cl-name">{r.land_assessment || ''}</td>
                  <td className="cl-name">{r.land_boundary || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>अनुक्रमांक</th>
                <th>जमिनीसह खरेदी किंवा संपादन केलेल्या इमारती, कोणत्याही असल्यास</th>
                <th>जमिनीची व इमारतीची विल्हेवाट</th>
                <th>विक्रीपासून मिळालेली रक्कम</th>
                <th>प्रमाणकाचा क्रमांक व दिनांक</th>
                <th>मालमत्तेची विल्हेवाट लावण्यासाठी पंचायतीचा ठराव क्रमांक व तारीख</th>
                <th>मालमत्तेची विल्हेवाट लावण्यासाठी कलम ५५ खालील प्राधिकाऱ्याच्या आदेशाचा क्रमांक व तारीख</th>
                <th>शेरा</th>
              </tr>
              <tr className="cl-numrow"><th />{[10, 11, 12, 13, 14, 15, 16].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td className="cl-name">{r.buildings_info || ''}</td>
                  <td className="cl-name">{r.disposal_details || ''}</td>
                  <td className="num">{r.recovered_amount != null ? fmt(r.recovered_amount) : ''}</td>
                  <td className="cl-name">{r.disposal_voucher || ''}</td>
                  <td className="cl-name">{r.disposal_resolution || ''}</td>
                  <td className="cl-name">{[r.disposal_authority, r.disposal_date ? fmtDate(r.disposal_date) : ''].filter(Boolean).join(' / ')}</td>
                  <td className="cl-name">{r.remark || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <div className="cb-note">
              टीप.- पंचायतीने खरेदी केलेल्या, संपादन केलेल्या किंवा मुंबई ग्रामपंचायत अधिनियम, १९५८ च्या कलम ५१ अन्वये शासनाने पंचायतीकडे निहित केलेल्या किंवा जिल्हा परिषदेने तिच्याकडे हस्तांतरित केलेल्या सर्व जमिनीबाबतची माहिती या नमुन्यात देण्यात येईल.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
