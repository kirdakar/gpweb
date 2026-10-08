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
const PER_PAGE = 4;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const D1 = range(1, 6);
const D2 = range(7, 27);
const D3 = range(28, 31);
const W1 = [3, 24, 28, 14, 8, ...D1.map(() => 3.8)];
const W2 = [3, ...D2.map(() => 4.6)];
const W3 = [3, ...D3.map(() => 4.5), 7, 7, 9, 7, 10, 19, 20];

// नमुना १९ [नियम २४(२)(ग)(५) व ५५(२) पाहा] - कामावर असलेल्या व्यक्तींचा हजेरीपट, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर तीन तक्ते
// (१: नाव, पत्ता, पदनाम, स्त्री/पुरुष, तारखा १-६; २: तारखा ७-२७; ३: तारखा २८-३१, एकूण, दर, रक्कम, दंड, देय शिल्लक, सही/अंगठा,
// आद्याक्षरी) - तिन्हीत ओळी एकाच मजुराच्या. डाटाएंट्री MusterEntry.jsx वर; दिवस/रक्कम/देय शिल्लक हजेरी व दरावरून आपोआप.
export default function MusterReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rolls, setRolls] = useState([]);
  const [rollId, setRollId] = useState('');
  const [roll, setRoll] = useState(null);

  useEffect(() => {
    if (!yearId) return;
    setRollId(''); setRoll(null);
    client.get('/muster-rolls', { params: { financialYearId: yearId } }).then(({ data }) => setRolls(data));
  }, [yearId]);
  useEffect(() => {
    if (!rollId) { setRoll(null); return; }
    client.get(`/muster-rolls/${rollId}`).then(({ data }) => setRoll(data));
  }, [rollId]);

  const daysInMonth = roll ? new Date(roll.year, roll.month, 0).getDate() : 31;
  const pages = useMemo(() => {
    const out = [];
    if (!roll) return out;
    for (let i = 0; i < roll.workers.length; i += PER_PAGE) out.push(roll.workers.slice(i, i + PER_PAGE));
    return out;
  }, [roll]);

  const dayCell = (w, d) => (d <= daysInMonth && w.attendance[d - 1] === 'P' ? 'ह' : '');
  const dayHead = (d) => <th key={d} style={d > daysInMonth ? { opacity: 0.35 } : undefined}>({mnum(d)})</th>;

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>हजेरीपट अहवाल (नमुना १९) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!roll || !can('reports_muster_roll', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={rollId} onChange={(e) => setRollId(e.target.value)} style={{ minWidth: 340 }}>
            <option value="">-- हजेरीपट निवडा --</option>
            {rolls.map((r) => <option key={r.id} value={r.id}>{MONTHS[r.month - 1]} {r.year} - {r.work_name || r.title || 'हजेरीपट'}</option>)}
          </select>
        </div>
      </div>

      {roll && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना १९</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २४(२)(ग)(५) व ५५(२) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>कामावर असलेल्या व्यक्तींचा हजेरीपट</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>
            माहे <strong>{MONTHS[roll.month - 1]}</strong> <strong>{currentYear?.year_label || '२०..-२०..'}</strong> मध्ये ({roll.work_name || roll.title || 'कामाचे स्वरूप'})
          </div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr><th>क्र.</th><th>संपूर्ण नाव</th><th>पत्ता</th><th>पदनाम</th><th>स्त्री/ पुरुष</th>{D1.map(dayHead)}</tr>
            </thead>
            <tbody>
              {list.map((w, i) => (
                <tr key={w.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td className="cl-name">{w.name}</td><td className="cl-name">{w.address || ''}</td><td className="cl-name">{w.post || ''}</td><td>{w.gender || ''}</td>
                  {D1.map((d) => <td key={d} style={{ textAlign: 'center' }}>{dayCell(w, d)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead><tr className="cl-numrow"><th>क्र.</th>{D2.map(dayHead)}</tr></thead>
            <tbody>
              {list.map((w, i) => (
                <tr key={w.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  {D2.map((d) => <td key={d} style={{ textAlign: 'center' }}>{dayCell(w, d)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W3.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>क्र.</th>{D3.map(dayHead)}
                <th>एकूण</th><th>दर</th><th>रक्कम</th><th>दंड</th><th>देय शिल्लक</th>
                <th>रक्कम घेणाऱ्याची सही किंवा अंगठ्याचा ठसा</th><th>रक्कम देतेवेळी पैसे देणाऱ्या अधिकाऱ्याची तारखेनिशी आद्याक्षरी</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w, i) => (
                <tr key={w.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  {D3.map((d) => <td key={d} style={{ textAlign: 'center' }}>{dayCell(w, d)}</td>)}
                  <td className="num">{w.days}</td><td className="num">{fmt(w.rate_per_day)}</td><td className="num">{fmt(w.gross_wage)}</td>
                  <td className="num">{Number(w.fine) ? fmt(w.fine) : ''}</td><td className="num"><strong>{fmt(w.net_wage)}</strong></td>
                  <td /><td />
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <div style={{ textAlign: 'right', marginTop: 8, fontSize: 12 }}>एकूण देय मजुरी <strong>{fmt(roll.total_wages)}</strong></div>
          )}
          <div className="cb-note">टीप.- (१) अन्य रूपाने रक्कम (मजुरी) द्यावयाची असेल तर, त्याबाबत स्वतंत्र नोंदवही ठेवण्यात येईल.</div>
        </div>
      ))}
    </div>
  );
}
