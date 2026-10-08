import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const dateKey = (v) => String(v).slice(0, 10);
const WIDTHS = [9, 8, 17, 22, 10, 10, 13, 11];

// नमुना ५-क - दैनिक रोकड वही (प्रत्येक दिवशी प्राप्त झालेल्या रकमांची नोंद; नंतर सर्वसाधारण रोकड वहीत - नमुना ५ - घेतली
// जाते). वेगळी नोंद करायची नाही: नमुना ५ मध्ये भरलेल्या जमा नोंदींवरूनच (तारीख, पावती क्रमांक, कोणाकडून, तपशील,
// रोख/धनादेश रक्कम, बँकेत जमा केल्याचा दिनांक) हा अहवाल तयार होतो - म्हणजे तीच माहिती दोनदा टाईप करावी लागत नाही.
export default function DailyCashReport() {
  const { yearId } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/cash-book', { params: { financialYearId: yearId, from, to, entryType: 'जमा', register: 'मुख्य' } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const days = useMemo(() => {
    const byDay = new Map();
    for (const r of rows) {
      const k = dateKey(r.entry_date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, list]) => ({
      date,
      list,
      cash: list.filter((r) => r.payment_mode !== 'धनादेश').reduce((s, r) => s + Number(r.amount), 0),
      cheque: list.filter((r) => r.payment_mode === 'धनादेश').reduce((s, r) => s + Number(r.amount), 0),
    }));
  }, [rows]);

  const purpose = (r) => {
    let n = r.narration || '';
    if (r.owner_name) n = n.replace(` - कोड ${r.property_code} - ${r.owner_name}`, '').replace(` - ${r.owner_name}`, '');
    return [`${r.head_code} ${r.head_name}`, n].filter(Boolean).join(' - ');
  };

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>दैनिक रोकड वही अहवाल (नमुना ५-क)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn secondary" type="button" onClick={load}>दाखवा</button>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_daily_cash', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="cashbook-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ५-क</div>
          <div style={{ textAlign: 'center', fontSize: 12 }}>(नियम २१, २२(२), (३), (४), (५) व (६), २४(१), २५(१), ३३(२), (५), ३३(२), (३) व (४) (च), ३६(२), ३८(२), ३८(१) आणि ६६(१) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15 }}>दैनिक रोकड वही</div>
          <div style={{ fontSize: 13, margin: '4px 0 6px' }}>ग्रामपंचायत {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <div className="cb-scroll">
            <table className="cb-table">
              <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th>जमा केल्याचा महिना व तारीख</th>
                  <th>पावती क्रमांक</th>
                  <th>कोणाकडून मिळाली ते</th>
                  <th>जमा रकमेसंबंधीचा तपशील</th>
                  <th>रोख रक्कम (रुपये)</th>
                  <th>धनादेश (चेक) (रुपये)</th>
                  <th>धनादेश बँकेत जमा केल्याचा दिनांक किंवा रोख रक्कम जमा केल्याचा दिनांक</th>
                  <th>धनादेश वटविल्याचा दिनांक</th>
                </tr>
                <tr className="cb-numrow">{Array.from({ length: 8 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {days.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 14 }}>या कालावधीत जमा नोंदी नाहीत</td></tr>}
                {days.map((d) => [
                  ...d.list.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i === 0 ? fmtDate(d.date) : ''}</td>
                      <td>{r.reference_no || ''}</td>
                      <td>{r.owner_name ? `${r.property_code ? `कोड ${r.property_code} - ` : ''}${r.owner_name}` : ''}</td>
                      <td>{purpose(r)}</td>
                      <td className="num">{r.payment_mode !== 'धनादेश' ? fmt(r.amount) : ''}</td>
                      <td className="num">{r.payment_mode === 'धनादेश' ? fmt(r.amount) : ''}</td>
                      <td>{r.bank_deposit_date ? fmtDate(r.bank_deposit_date) : ''}</td>
                      <td />
                    </tr>
                  )),
                  <tr key={`${d.date}-t`} className="cb-total">
                    <td colSpan={4} style={{ textAlign: 'right' }}>एकूण जमा ({fmtDate(d.date)})</td>
                    <td className="num">{fmt(d.cash)}</td>
                    <td className="num">{fmt(d.cheque)}</td>
                    <td colSpan={2} />
                  </tr>,
                  <tr key={`${d.date}-w`}>
                    <td colSpan={8} style={{ fontWeight: 400 }}>
                      एकूण रोख रुपये ({fmt(d.cash)}) अक्षरी {d.cash > 0 ? amountToMarathiWords(d.cash) : 'शून्य रुपये मात्र'} ची नोंद सर्वसाधारण रोकड वहीच्या पुष्ठ क्रमांक ---- वर घेतली आहे.
                    </td>
                  </tr>,
                ])}
              </tbody>
            </table>
          </div>

          <div className="cb-note">
            <div>टीप.- (१) सर्व नोंदी तपासून आद्याक्षरी सरपंच करतील, प्रत्येक दिवशी प्राप्त झालेली एकूण रक्कम अंकात व अक्षरात लिहून पूर्ण स्वाक्षरी करतील.</div>
            <div>(२) ज्यावेळी धनादेशाद्वारे रकमा प्राप्त होतील त्यावेळी धनादेश बँकेत जमा केल्याचा दिनांक रकाना ८ मध्ये नमूद करून रक्कम सामान्य रोकड वही मध्ये जमा बाजूस बँक रकान्यात नोंद घ्यावी.</div>
          </div>
        </div>
      )}
    </div>
  );
}
