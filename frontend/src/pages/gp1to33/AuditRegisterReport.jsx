import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const cnt = (n) => (Number(n) ? Number(n) : '');
const PER_PAGE = 4;
const W1 = [4, 9, 11, 19, 16, 16, 25];
const W2 = [14, 22, 14, 8, 8, 8, 8, 8, 10];

// नमुना ३० (नियम ७३(३) पाहा) - ग्रामपंचायत लेखापरीक्षण आक्षेप पूर्तता नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते
// (१: अ. क्र., अहवाल वर्ष, प्राप्त दिनांक, आक्षेपांची संख्या व अनुक्रमांक, केवळ माहितीसाठी, पूर्तता करावयाचे, ग्रामपंचायतीने पूर्तता केलेले;
// २: पंचायत समितीकडे जावक, जि.प./लेखा परीक्षकाकडे ठराव/जावक, मंजूर, शिल्लक आक्षेपांची वर्गवारी, शेरा). डाटाएंट्री AuditReportEntry.jsx वर;
// पूर्तता/मंजूर आकडे पूर्तता नोंदींवरून आपोआप. (कागदावरील "क्रमांक" रकान्यांसाठी फक्त अहवालातील क्रमांक-मजकूर/संख्या येतात.)
export default function AuditRegisterReport() {
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/audit-reports').then(({ data }) => setRows([...data].reverse())).finally(() => setLoading(false)); // जुने आधी
  }, []);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>लेखापरीक्षण आक्षेप पूर्तता नोंदवही (नमुना ३०)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_audit_register', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>नोंदी नाहीत.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ३०</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम ७३(३) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>ग्रामपंचायत लेखापरीक्षण आक्षेप पूर्तता नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>
            ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; तालुका : {settings?.taluka ? <strong>{settings.taluka}</strong> : '----------'} &nbsp; जिल्हा : {settings?.district ? <strong>{settings.district}</strong> : '----------'}
          </div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>अ. क्र.</th><th>लेखापरीक्षण अहवाल वर्ष</th><th>लेखापरीक्षण अहवाल प्राप्त झाल्याचा दिनांक</th>
                <th>अहवालातील आक्षेपांची संख्या व त्यांचा अनुक्रमांक</th><th>केवळ माहितीसाठी असणारा आक्षेप क्रमांक व संख्या</th>
                <th>पूर्तता करावयाच्या आक्षेपांचे क्रमांक व संख्या</th><th>ग्रामपंचायतीने पूर्तता केलेले आक्षेपांचे क्रमांक व संख्या</th>
              </tr>
              <tr className="cl-numrow">{[1, 2, 3, 4, 5, 6, 7].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td>{r.report_year}</td>
                  <td>{r.received_date ? fmtDate(r.received_date) : ''}</td>
                  <td className="cl-name">{r.total_objections}{r.objection_numbers ? ` (${r.objection_numbers})` : ''}</td>
                  <td className="cl-name">{cnt(r.info_only_count)}</td>
                  <td className="cl-name">{r.to_comply_count}</td>
                  <td className="cl-name">{cnt(r.complied_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>पूर्तता केलेले आक्षेप पंचायत समितीकडे पाठविल्याचा जावक क्रमांक व दिनांक</th>
                <th rowSpan={2}>पूर्तता केलेले आक्षेप पंचायत समिती जि.प./लेखा परीक्षकाकडे पाठविलेल्याचा ठराव क्रमांक व दिनांक व जावक क्र. व दिनांक</th>
                <th rowSpan={2}>जि. प./लेखा परीक्षक यांनी मंजूर केलेले आक्षेप क्रमांक व संख्या</th>
                <th colSpan={5}>शिल्लक आक्षेपांची वर्गवारी व क्रमांक</th>
                <th rowSpan={2}>शेरा</th>
              </tr>
              <tr><th>पुस्तकी समायोजन</th><th>वसुली</th><th>मूल्यांकन</th><th>नियमबाह्य</th><th>एकूण</th></tr>
              <tr className="cl-numrow">{[8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} style={{ height: 38 }}>
                  <td className="cl-name">{r.outward_no || ''}</td>
                  <td className="cl-name">{r.ps_resolution_info || ''}</td>
                  <td className="cl-name">{cnt(r.auditor_accepted_total)}</td>
                  <td className="num">{cnt(r.rem_book_adjustment)}</td>
                  <td className="num">{cnt(r.rem_recovery)}</td>
                  <td className="num">{cnt(r.rem_valuation)}</td>
                  <td className="num">{cnt(r.rem_irregular)}</td>
                  <td className="num"><strong>{cnt(r.rem_total)}</strong></td>
                  <td className="cl-name">{r.remark || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
