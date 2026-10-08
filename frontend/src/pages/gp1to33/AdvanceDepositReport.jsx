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
const cell = (n) => (Number(n) ? Number(n).toFixed(2) : '');
const PER_PAGE = 6;
// आर्थिक वर्ष एप्रिल ते मार्च - (महिना क्रमांक, नाव)
const MONTHS = [[4, 'एप्रिल'], [5, 'मे'], [6, 'जून'], [7, 'जुलै'], [8, 'ऑगस्ट'], [9, 'सप्टेंबर'], [10, 'ऑक्टोबर'], [11, 'नोव्हेंबर'],
  [12, 'डिसेंबर'], [1, 'जानेवारी'], [2, 'फेब्रुवारी'], [3, 'मार्च']];
const TOP_MONTHS = MONTHS.slice(0, 8);
const BOTTOM_MONTHS = MONTHS.slice(8);
const monthOf = (d) => Number(String(d).slice(5, 7));

// नमुना १७ [नियम ६३, ६६(१) व (२)] - अग्रिम दिलेल्या/अनामत ठेवलेल्या रकमांची नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या
// पानावर दोन तक्ते (वरचा: महिना व तारीख...नोव्हेंबरची परतफेड, खालचा: डिसेंबर...शेरा; दोन्हीत ओळी एकाच नोंदीच्या).
// डाटाएंट्री AdvanceDepositEntry.jsx वर. मूळ रक्कम नमुना ५ वरून, परतफेड/समायोजन त्या नोंदीच्या "परतफेड" कृतीवरून -
// मासिक रकाने त्यांच्या तारखेवरून आपोआप, काहीही दुसऱ्यांदा टाईप करायचे नाही.
export default function AdvanceDepositReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('सर्व');

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/advance-deposits', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows([...data].reverse())) // जुनी आधी (तारखेनुसार चढत्या क्रमाने)
      .finally(() => setLoading(false));
  }, [yearId]);

  const shown = useMemo(() => (kind === 'सर्व' ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);

  // प्रत्येक नोंदीसाठी महिन्यानुसार परतफेड, एकूण परतफेड, वर्षाअखेरची शिल्लक, मासिक एकूण (त्या महिन्यातील नोंदींची रक्कम)
  const data = useMemo(() => {
    const monthTotals = {};
    for (const r of shown) {
      const m = monthOf(r.entry_date);
      monthTotals[m] = (monthTotals[m] || 0) + Number(r.amount);
    }
    return shown.map((r, i) => {
      const byMonth = {};
      let repaid = 0;
      for (const s of r.settlements || []) {
        const m = monthOf(s.settlement_date);
        byMonth[m] = (byMonth[m] || 0) + Number(s.amount);
        repaid += Number(s.amount);
      }
      const nextSame = shown[i + 1] && monthOf(shown[i + 1].entry_date) === monthOf(r.entry_date);
      return { ...r, byMonth, repaid, yearEnd: Number(r.amount) - repaid, monthTotal: nextSame ? null : monthTotals[monthOf(r.entry_date)] };
    });
  }, [shown]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < data.length; i += PER_PAGE) out.push(data.slice(i, i + PER_PAGE));
    return out;
  }, [data]);

  const totals = {
    amount: data.reduce((s, r) => s + Number(r.amount), 0),
    repaid: data.reduce((s, r) => s + r.repaid, 0),
    yearEnd: data.reduce((s, r) => s + r.yearEnd, 0),
  };
  const topW = [3, 7.5, 11, 12, 6, 7, 7, ...TOP_MONTHS.map(() => 5.8)];
  const botW = [3, ...BOTTOM_MONTHS.map(() => 8), 9, 20, 10, 26];

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>अग्रिम/अनामत अहवाल (नमुना १७) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={data.length === 0 || !can('reports_advance_deposits', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['सर्व', 'अग्रिम', 'अनामत'].map((k) => (
          <button key={k} type="button" className={`btn ${kind === k ? '' : 'secondary'}`} onClick={() => setKind(k)}>{k}</button>
        ))}
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && data.length === 0 && <p>या वर्षात नोंदी नाहीत.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना १७</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>[(नियम ६३, ६६(१) व (२)]</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>अग्रिम दिलेल्या/अनामत ठेवलेल्या रकमांची नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; (सन {currentYear?.year_label})</div>

          <table className="cl-table">
            <colgroup>{topW.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>क्र.</th>
                <th rowSpan={2}>महिना व तारीख</th>
                <th rowSpan={2}>पक्षकाराचे नाव</th>
                <th rowSpan={2}>अग्रिम रकमेचा किंवा अनामत ठेवलेल्या रकमेचा तपशील</th>
                <th rowSpan={2}>प्रमाणक किंवा पावती क्रमांक</th>
                <th rowSpan={2}>रक्कम</th>
                <th rowSpan={2}>मासिक एकूण</th>
                <th colSpan={8}>रोख परतफेड किंवा समायोजन</th>
              </tr>
              <tr>{TOP_MONTHS.map(([, n]) => <th key={n}>{n}<br />रु. पै.</th>)}</tr>
              <tr className="cl-numrow"><th />{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => <th key={n}>({mnum(n)})</th>).slice(0, 14)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td>{fmtDate(r.entry_date)}</td>
                  <td className="cl-name">{r.party_name}</td>
                  <td className="cl-name">[{r.kind}] {r.description || ''}</td>
                  <td>{r.voucher_no || ''}</td>
                  <td className="num">{fmt(r.amount)}</td>
                  <td className="num">{r.monthTotal != null ? fmt(r.monthTotal) : ''}</td>
                  {TOP_MONTHS.map(([m]) => <td key={m} className="num cl-day">{cell(r.byMonth[m])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 10 }}>
            <colgroup>{botW.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>क्र.</th>
                <th colSpan={4}>रोख परतफेड किंवा समायोजन</th>
                <th rowSpan={2}>एकूण परतफेड रु. पै.</th>
                <th rowSpan={2}>परतफेडीची तारीख किंवा समायोजनाच्या प्रमाणकाचा क्रमांक</th>
                <th rowSpan={2}>वर्षाच्या अखेरची शिल्लक</th>
                <th rowSpan={2}>शेरा</th>
              </tr>
              <tr>{BOTTOM_MONTHS.map(([, n]) => <th key={n}>{n}<br />रु. पै.</th>)}</tr>
              <tr className="cl-numrow"><th />{[15, 16, 17, 18, 19, 20, 21, 22].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  {BOTTOM_MONTHS.map(([m]) => <td key={m} className="num cl-day">{cell(r.byMonth[m])}</td>)}
                  <td className="num">{cell(r.repaid)}</td>
                  <td className="cl-name">{(r.settlements || []).map((s) => [fmtDate(s.settlement_date), s.note].filter(Boolean).join(' ')).join('; ')}</td>
                  <td className="num">{fmt(r.yearEnd)}</td>
                  <td className="cl-name">{r.remark || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 8, fontSize: 12 }}>
              <span>एकूण रक्कम <strong>{fmt(totals.amount)}</strong></span>
              <span>एकूण परतफेड/समायोजन <strong>{fmt(totals.repaid)}</strong></span>
              <span>वर्षाच्या अखेरची एकूण शिल्लक <strong>{fmt(totals.yearEnd)}</strong></span>
            </div>
          )}
          <div className="cb-note">टीप.- शेरे व दुरुस्त्या सरपंचाने अनुप्रमाणित कराव्यात.</div>
        </div>
      ))}
    </div>
  );
}
