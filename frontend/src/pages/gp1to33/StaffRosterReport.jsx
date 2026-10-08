import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const WIDTHS = [6, 13, 7, 13, 9, 12, 16, 9, 8, 7];

// नमुना १३ (नियम ३१(२), ४२(२) पाहा) - कर्मचारी वर्गाची सूची व वेतनश्रेणी नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या
// पानावर १० रकान्यांसह. डाटाएंट्री StaffMaster.jsx वर (दैनिक व्यवहार / मास्टर); इथे फक्त छापील रूप - सर्व पदे
// (सेवेतून बाहेर झालेल्यांसह, शेऱ्यात तसे नमूद). सरपंचाची सही व सही रकाने हाताने सही करण्यासाठी रिकामे.
export default function StaffRosterReport() {
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/staff').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर्मचारी सूची व वेतनश्रेणी अहवाल (नमुना १३)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_staff_master', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना १३</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम ३१(२), ४२(२) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0' }}>कर्मचारी वर्गाची सूची व वेतनश्रेणी नोंदवही</div>
          <div style={{ fontSize: 13, margin: '4px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th>अनुक्रमांक</th>
                  <th>पदनाम</th>
                  <th>पदांची संख्या</th>
                  <th>मंजूर पदे आदेश क्रमांक व दिनांक</th>
                  <th>पूर्णकालिक / अंशकालिक</th>
                  <th>मंजूर वेतनश्रेणी</th>
                  <th>नियुक्त केलेल्या कर्मचाऱ्याचे नाव</th>
                  <th>नियुक्तीचा दिनांक</th>
                  <th>सरपंचाची सही</th>
                  <th>सही</th>
                </tr>
                <tr className="cb-numrow">{Array.from({ length: 10 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 14 }}>अद्याप नोंद नाही</td></tr>}
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ height: 36 }}>
                    <td className="num">{mnum(i + 1)}</td>
                    <td>{r.post_name}</td>
                    <td className="num">{mnum(r.post_count)}</td>
                    <td>{[r.sanction_order_no, r.sanction_date ? fmtDate(r.sanction_date) : ''].filter(Boolean).join(' / ')}</td>
                    <td>{r.employment_type}</td>
                    <td>{r.pay_scale || ''}</td>
                    <td>{r.employee_name || ''}{!r.is_active ? ' (सेवेतून बाहेर)' : ''}</td>
                    <td>{r.appointment_date ? fmtDate(r.appointment_date) : ''}</td>
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
