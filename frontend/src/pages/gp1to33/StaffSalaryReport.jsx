import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const cell = (n) => (Number(n) ? Number(n).toFixed(2) : '');
const PER_PAGE = 4;
const W1 = [3, 14, 13, 14, 9, 9, 9, 9, 10, 10];
const W2 = [3, 11, 13, 11, 11, 11, 13, 13, 14];

// नमुना २१ [नियम २४(२)(ग)(१), ४२(१)(३) व (४)(द)] - ग्रामपंचायतीच्या कर्मचाऱ्यांच्या वेतन देयकाची नोंदवही, कागदी नमुन्याप्रमाणे
// A4 आडव्या पानावर दोन तक्ते (१: नाव, पद, वेतनश्रेणी, वेतन, रजा वेतन, स्थानापन्न वेतन, भत्ते, बेरीज, पुढील अधिदानासाठी ठेवलेली रक्कम;
// २: वसुली व दंड, शिल्लक, वजाती, निव्वळ रक्कम, शेरा/आदात्याची सही) - दोन्हीत ओळी एकाच कर्मचाऱ्याच्या. डाटाएंट्री
// StaffSalaryEntry.jsx वर; बेरीज/शिल्लक/निव्वळ रक्कम आपोआप.
export default function StaffSalaryReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/staff-salary-bills', { params: { financialYearId: yearId, year, month } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId, year, month]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  const sum = (k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक वेतन देयक अहवाल (नमुना २१)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_staff_salary_bills', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>नोंदी नाहीत.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २१</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २४(२)(ग)(१), ४२(१)(३) व (४)(द))</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>
            महिना <strong>{MONTHS[month - 1]} {year}</strong> ची ग्रामपंचायतीच्या कर्मचाऱ्यांच्या वेतन देयकाची नोंदवही
          </div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; (सन {currentYear?.year_label})</div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>क्र.</th><th>नाव</th><th>पद</th><th>वेतनश्रेणी किंवा विशेष वेतन</th>
                <th>वेतन<br />रु. पै.</th><th>रजा वेतन<br />रु. पै.</th><th>स्थानापन्न वेतन<br />रु. पै.</th><th>भत्ते<br />रु. पै.</th>
                <th>स्तंभ ४ ते ७ ची बेरीज<br />रु. पै.</th><th>पुढील अधिदानासाठी ठेवलेली रक्कम<br />रु. पै.</th>
              </tr>
              <tr className="cl-numrow"><th />{Array.from({ length: 9 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.staff_id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td className="cl-name">{r.employee_name || ''}</td>
                  <td className="cl-name">{r.post_name}</td>
                  <td className="cl-name">{r.pay_scale || ''}</td>
                  <td className="num">{cell(r.basic_pay)}</td><td className="num">{cell(r.leave_pay)}</td>
                  <td className="num">{cell(r.suspension_pay)}</td><td className="num">{cell(r.allowances)}</td>
                  <td className="num"><strong>{fmt(r.grossTotal)}</strong></td><td className="num">{cell(r.reserved_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>क्र.</th>
                <th rowSpan={2}>वसुली व दंड<br />रु. पै.</th>
                <th rowSpan={2}>स्तंभ ८ मधून स्तंभ ९ व १० ची बेरीज वजा केल्यावर उरलेली शिल्लक<br />रु. पै.</th>
                <th colSpan={3}>वजाती</th>
                <th rowSpan={2}>स्तंभ ११ मधून स्तंभ १४ वजा केल्यानंतर द्यावयाची निव्वळ रक्कम<br />रु. पै.</th>
                <th rowSpan={2}>शेरा</th>
                <th rowSpan={2}>आदात्याची सही</th>
              </tr>
              <tr><th>भविष्य निर्वाह निधी अंशदान<br />रु. पै.</th><th>इतर वजाती<br />रु. पै.</th><th>एकूण वजाती स्तंभ १२ व १३ यांची बेरीज<br />रु. पै.</th></tr>
              <tr className="cl-numrow"><th />{[10, 11, 12, 13, 14, 15, 16].map((n) => <th key={n}>({mnum(n)})</th>)}<th /></tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.staff_id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td className="num">{cell(r.recovery_fine)}</td>
                  <td className="num">{fmt(r.balanceAfterReserve)}</td>
                  <td className="num">{cell(r.pf_deduction)}</td><td className="num">{cell(r.other_deductions)}</td>
                  <td className="num">{fmt(r.totalDeductions)}</td>
                  <td className="num"><strong>{fmt(r.netPayable)}</strong></td>
                  <td className="cl-name">{r.remark || ''}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <>
              <div style={{ textAlign: 'right', marginTop: 6, fontSize: 12 }}>
                एकूण वेतन <strong>{fmt(sum('grossTotal'))}</strong> &nbsp;|&nbsp; एकूण वजाती <strong>{fmt(sum('totalDeductions'))}</strong> &nbsp;|&nbsp; एकूण निव्वळ देय <strong>{fmt(sum('netPayable'))}</strong>
              </div>
              <div style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
                <div>असे प्रमाणित करण्यात येते की, (१) वेतनश्रेणी नोंदवहीत नोंद केलेल्या मंजूर वेतनश्रेणीवरून देयक पडताळून पाहिले आहे.</div>
                <div>(२) पंधरा रुपयांहून अधिक नाही इतक्या पगारावर लावलेल्या व्यक्तीचे पगार या देयकात काढले आहेत व त्या सर्व व्यक्ती या महिन्यात कामावर लावल्या होत्या.</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
                <div>दिनांक : ------- &nbsp; वेतन रुपये : <strong>{fmt(sum('netPayable'))}</strong><br />तपासणी केली व बरोबर असल्याचे आढळून आले.<br />सचिव</div>
                <div style={{ textAlign: 'center' }}>सरपंच<br />ग्रामपंचायत {gpName ? <strong>{gpName}</strong> : '-----'}</div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
