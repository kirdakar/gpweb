import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const WIDTHS = [3, 11, 8, 8, 4, 6, 7, 8, 9, 7, 8, 7, 7, 7];

// नमुना ११ (नियम ३६(१) व (२), ३७(१) पाहा) - किरकोळ मागणी नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर १४ रकान्यांसह.
// डाटाएंट्री MiscDemandEntry.jsx वर; हे फक्त छापील रूप. हप्ता = हप्त्यांची संख्या, (६) = प्रत्येक हप्त्याची रक्कम,
// (७) = एकूण मागणी; वसुली/सूट ज्या ज्या वेळी नोंदवली तितक्या स्वतंत्र ओळी (मागणीचे रकाने एकदाच).
export default function MiscDemandReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/misc-demands', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows([...data].reverse()))
      .finally(() => setLoading(false));
  }, [yearId]);

  const tot = (k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>किरकोळ मागणी अहवाल (नमुना ११) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_misc_demands', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ११</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम ३६(१) व (२), ३७(१) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0' }}>
            सन <strong>{currentYear?.year_label || '२०.... - २०....'}</strong> या वर्षासाठी किरकोळ मागणी नोंदवही
          </div>
          <div style={{ fontSize: 13, margin: '4px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>अ. क्र.</th>
                  <th rowSpan={2}>ज्या व्यक्तीने मागणीची रक्कम द्यावयाची आहे त्या व्यक्तीचे नाव व पत्ता</th>
                  <th rowSpan={2}>मागणीचे स्वरूप</th>
                  <th rowSpan={2}>मागणीसाठी प्राधिकार</th>
                  <th colSpan={3}>मागणी</th>
                  <th rowSpan={2}>देयक क्रमांक व तारीख</th>
                  <th colSpan={2}>वसूल झालेल्या रकमा</th>
                  <th colSpan={2}>सूट</th>
                  <th rowSpan={2}>शिल्लक</th>
                  <th rowSpan={2}>शेरा</th>
                </tr>
                <tr>
                  <th>हप्ता</th><th>रक्कम</th><th>एकूण रक्कम</th>
                  <th>पावतीचा क्रमांक व तारीख</th><th>रक्कम (रु.)</th>
                  <th>आदेशाचा क्रमांक व तारीख</th><th>रक्कम (रु.)</th>
                </tr>
                <tr className="cb-numrow">{Array.from({ length: 14 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={14} style={{ textAlign: 'center', padding: 14 }}>नोंदी नाहीत</td></tr>}
                {rows.map((d, idx) => {
                  const rec = d.events.filter((e) => e.kind === 'वसुली');
                  const waive = d.events.filter((e) => e.kind === 'सूट');
                  const lines = Math.max(rec.length, waive.length, 1);
                  const count = Number(d.installment_count) || 1;
                  const out = [];
                  for (let i = 0; i < lines; i += 1) {
                    const r = rec[i];
                    const w = waive[i];
                    out.push(
                      <tr key={`${d.id}-${i}`}>
                        {i === 0 && <td rowSpan={lines}>{mnum(idx + 1)}</td>}
                        {i === 0 && <td rowSpan={lines}>{d.party_name}{d.address ? `, ${d.address}` : ''}</td>}
                        {i === 0 && <td rowSpan={lines}>{d.nature || ''}</td>}
                        {i === 0 && <td rowSpan={lines}>{d.authority || ''}</td>}
                        {i === 0 && <td rowSpan={lines} className="num">{mnum(count)}</td>}
                        {i === 0 && <td rowSpan={lines} className="num">{fmt(Number(d.amount) / count)}</td>}
                        {i === 0 && <td rowSpan={lines} className="num">{fmt(d.amount)}</td>}
                        {i === 0 && <td rowSpan={lines}>{[d.demand_no, d.demand_date ? fmtDate(d.demand_date) : ''].filter(Boolean).join(' / ')}</td>}
                        <td>{r ? [r.receipt_no, fmtDate(r.event_date)].filter(Boolean).join(' / ') : ''}</td>
                        <td className="num">{r ? fmt(r.amount) : ''}</td>
                        <td>{w ? [w.order_no, fmtDate(w.event_date)].filter(Boolean).join(' / ') : ''}</td>
                        <td className="num">{w ? fmt(w.amount) : ''}</td>
                        {i === 0 && <td rowSpan={lines} className="num">{fmt(d.balance)}</td>}
                        {i === 0 && <td rowSpan={lines}>{d.remark || ''}</td>}
                      </tr>
                    );
                  }
                  return out;
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="cb-total">
                    <td colSpan={6} style={{ textAlign: 'right' }}>एकूण</td>
                    <td className="num">{fmt(tot('amount'))}</td>
                    <td colSpan={2} />
                    <td className="num">{fmt(tot('recovered_total'))}</td>
                    <td />
                    <td className="num">{fmt(tot('waived_total'))}</td>
                    <td className="num">{fmt(tot('balance'))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="cb-note">टीप.- शेरे व दुरुस्त्या सरपंचाने अनुप्रमाणित कराव्यात.</div>
        </div>
      )}
    </div>
  );
}
