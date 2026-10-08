import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const REGISTERS = ['मुख्य', 'किरकोळ'];
const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const dateKey = (v) => String(v).slice(0, 10);
// कर जमा पावतीवरून आलेल्या नोंदीच्या narration मधील "कोड X - नाव -" भाग "कोणाकडून" रकान्यात आधीच असल्याने वगळतो.
function purpose(r) {
  const n = r.narration || '';
  if (!r.owner_name) return n;
  return n.replace(` - कोड ${r.property_code} - ${r.owner_name}`, '').replace(` - ${r.owner_name}`, '');
}
const WIDTHS = [7, 3, 9, 8, 6.5, 7, 6.5, 7, 4, 4, 7, 7.5, 5.5, 7, 6.5, 4.5];

// नमुना ५ (मुख्य) / नमुना १८ (किरकोळ) - कागदी "सामान्य रोकड वही" प्रमाणे A4 आडव्या पानावर
// जमा (१-८) डावीकडे व खर्च (९-१६) उजवीकडे. दिवसानुसार गट: त्या दिवसाच्या जमा/खर्च नोंदी समोरासमोर,
// नंतर एकूण ओळ (प्रारंभिक शिल्लकेसह जमा = खर्च + अखेरची शिल्लक). शिल्लक त्या आर्थिक वर्षातील
// आधीच्या सर्व नोंदींवरून आपोआप चालत येते - हाताने टाईप करायची नाही.
export default function CashBookReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [register, setRegister] = useState('मुख्य');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    // संपूर्ण वर्षाच्या नोंदी (शिल्लक चालू ठेवण्यासाठी) - दाखवताना फक्त निवडलेला कालावधी.
    client.get('/cash-book', { params: { financialYearId: yearId, to, register } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId, register]);

  const { days, jamaTotal, kharchTotal } = useMemo(() => {
    let balance = 0;
    const byDay = new Map();
    for (const r of rows) {
      const k = dateKey(r.entry_date);
      if (k < from) { balance += (r.entry_type === 'जमा' ? 1 : -1) * Number(r.amount); continue; }
      if (k > to) continue;
      if (!byDay.has(k)) byDay.set(k, { date: k, jama: [], kharch: [] });
      byDay.get(k)[r.entry_type === 'जमा' ? 'jama' : 'kharch'].push(r);
    }
    let serial = 0;
    let jt = 0;
    let kt = 0;
    const list = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map((d) => {
      const opening = balance;
      const dj = d.jama.reduce((s, r) => s + Number(r.amount), 0);
      const dk = d.kharch.reduce((s, r) => s + Number(r.amount), 0);
      balance = opening + dj - dk;
      jt += dj; kt += dk;
      const serialStart = serial;
      serial += d.jama.length;
      return { ...d, opening, closing: balance, dj, dk, serialStart };
    });
    return { days: list, jamaTotal: jt, kharchTotal: kt };
  }, [rows, from, to]);

  const title = register === 'मुख्य' ? 'सामान्य रोकड वही' : 'किरकोळ रोकडवही';

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>{register === 'मुख्य' ? 'रोकड वही अहवाल (नमुना ५)' : 'किरकोळ रोकडवही अहवाल (नमुना १८)'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn secondary" type="button" onClick={load}>दाखवा</button>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_cash_book', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {REGISTERS.map((r) => (
          <button key={r} type="button" className={`btn ${register === r ? '' : 'secondary'}`} onClick={() => setRegister(r)}>{r}</button>
        ))}
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना {register === 'मुख्य' ? '५' : '१८'}</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>
            {register === 'मुख्य' ? '(नियम १९(७), २२(२), (३), (६), (७), (१०), २३, २४(ख) व २५(२) पाहा)' : '(किरकोळ रोकडवही)'}
          </div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15 }}>{title}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '4px 0 6px' }}>
            <span>वर्ष <strong>{currentYear?.year_label || '20....'}</strong> &nbsp; (कालावधी: {fmtDate(from)} ते {fmtDate(to)})</span>
            <span>ग्रामपंचायत {gpName ? <strong>{gpName}</strong> : '.........................'}</span>
          </div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>
                {WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>महिना व रक्कम जमा केल्याची तारीख</th>
                  <th rowSpan={2}>अनुक्रमांक</th>
                  <th colSpan={2}>जमा रकमांचा तपशील</th>
                  <th rowSpan={2}>लेखा शीर्ष</th>
                  <th rowSpan={2}>रक्कम</th>
                  <th rowSpan={2}>प्रारंभिक शिल्लकेसह रोजची एकूण रक्कम</th>
                  <th rowSpan={2}>रक्कम दिल्याची तारीख व पावती क्रमांक</th>
                  <th rowSpan={2} className="cb-split">धनादेश (चेक) क्रमांक</th>
                  <th rowSpan={2}>प्रमाणक (व्हाऊचर) क्रमांक</th>
                  <th colSpan={2}>रक्कम दिल्याचा तपशील</th>
                  <th rowSpan={2}>लेखा शीर्ष</th>
                  <th rowSpan={2}>रक्कम</th>
                  <th rowSpan={2}>अखेरच्या शिल्लकेसह रोजची एकूण रक्कम</th>
                  <th rowSpan={2}>स्वाक्षरी</th>
                </tr>
                <tr>
                  <th>कोणाकडून मिळालीत</th><th>कशाबद्दल मिळाली ते</th>
                  <th>कोणास दिली ते</th><th>कोणत्या कारणासाठी दिली ते</th>
                </tr>
                <tr className="cb-numrow">
                  {Array.from({ length: 16 }, (_, i) => <th key={i} className={i === 8 ? 'cb-split' : ''}>({mnum(i + 1)})</th>)}
                </tr>
              </thead>
              <tbody>
                {days.length === 0 && <tr><td colSpan={16} style={{ textAlign: 'center', padding: 14 }}>या कालावधीत नोंदी नाहीत</td></tr>}
                {days.map((d) => {
                  const n = Math.max(d.jama.length, d.kharch.length, 1);
                  const trs = [];
                  for (let i = 0; i < n; i += 1) {
                    const j = d.jama[i];
                    const k = d.kharch[i];
                    trs.push(
                      <tr key={`${d.date}-${i}`}>
                        <td>{i === 0 ? fmtDate(d.date) : ''}</td>
                        <td className="num">{j ? mnum(d.serialStart + i + 1) : ''}</td>
                        <td>{j && j.owner_name ? `${j.property_code ? `कोड ${j.property_code} - ` : ''}${j.owner_name}` : ''}</td>
                        <td>{j ? purpose(j) : ''}</td>
                        <td>{j ? `${j.head_code} ${j.head_name}` : ''}</td>
                        <td className="num">{j ? fmt(j.amount) : ''}</td>
                        <td />
                        <td>{j ? [j.reference_date ? fmtDate(j.reference_date) : '', j.reference_no || ''].filter(Boolean).join(' / ') : ''}</td>
                        <td className="cb-split" />
                        <td>{k ? (k.reference_no || '') : ''}</td>
                        <td />
                        <td>{k ? (k.narration || '') : ''}</td>
                        <td>{k ? `${k.head_code} ${k.head_name}` : ''}</td>
                        <td className="num">{k ? fmt(k.amount) : ''}</td>
                        <td />
                        <td />
                      </tr>
                    );
                  }
                  trs.push(
                    <tr key={`${d.date}-t`} className="cb-total">
                      <td colSpan={5} style={{ textAlign: 'right' }}>प्रारंभिक शिल्लक {fmt(d.opening)} सह एकूण जमा</td>
                      <td className="num">{fmt(d.dj)}</td>
                      <td className="num">{fmt(d.opening + d.dj)}</td>
                      <td />
                      <td className="cb-split" colSpan={4} style={{ textAlign: 'right' }}>एकूण खर्च (अखेरची शिल्लक {fmt(d.closing)} सह)</td>
                      <td />
                      <td className="num">{fmt(d.dk)}</td>
                      <td className="num">{fmt(d.dk + d.closing)}</td>
                      <td />
                    </tr>
                  );
                  return trs;
                })}
              </tbody>
              {days.length > 0 && (
                <tfoot>
                  <tr className="cb-total">
                    <td colSpan={5} style={{ textAlign: 'right' }}>कालावधीची एकूण जमा</td>
                    <td className="num">{fmt(jamaTotal)}</td>
                    <td colSpan={2} />
                    <td className="cb-split" colSpan={4} style={{ textAlign: 'right' }}>कालावधीचा एकूण खर्च</td>
                    <td />
                    <td className="num">{fmt(kharchTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="cb-note">
            <div>टीप.- (१) प्रत्येक दिवशी व्यवहार बंद झाल्यानंतर रोख शिल्लक अंकात व अक्षरात लिहावी. सरपंचाने ती तपासून दिनांकासह स्वाक्षरी करावी.</div>
            <div>(२) प्रारंभिक व अखेरच्या शिल्लक रकमेचे स्पष्टीकरण द्यावे. उदा. पोस्ट, बँक, मुदत ठेव, इतर गुंतवणूक (गुंतवणूक नोंदवहीवरून).</div>
            <div>(३) नमुना ५ मध्ये महिन्याच्या अखेरीस, आर्थिक व्यवहाराची नोंद घेऊन त्याबाबतची एकत्रित माहिती नमुना २६क मध्ये नोंदवायची असते.</div>
          </div>
        </div>
      )}
    </div>
  );
}
