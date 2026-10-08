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
const cell = (n) => (n == null || n === '' ? '' : Number(n).toFixed(2));
const PER_PAGE = 5;
const W1 = [4, 8, 24, 10, 10, 10, 10, 10, 14];
const W2 = [4, 14, 15, 15, 24, 14, 14];

// नमुना २५ [नियम १६(१) व (२) आणि २२(१) पाहा] - गुंतवणूक नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते (१: अ.क्र., गुंतवणुकीची
// तारीख, तपशील, दर्शनी मूल्य, खरेदी किंमत, परिणत होण्याची तारीख, निव्वळ देय रक्कम, उपार्जित व्याजाची तारीख, सचिवांची सही; २: सरपंचाची सही,
// दिनांक, दैनिक रोकड वहीतील जमा रक्कम, प्रक्रांतीचा तपशील, सह्या). डाटाएंट्री InvestmentEntry.jsx वर; परिपक्वतेचा दिनांक व जमा रक्कम
// "परिपक्व करा" कृतीतून रोकड वहीच्या नोंदीवरूनच आपोआप येतात.
export default function InvestmentReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/investments', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows([...data].reverse())) // जुनी आधी
      .finally(() => setLoading(false));
  }, [yearId]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  const totalPurchase = rows.reduce((s, r) => s + Number(r.purchase_price), 0);
  const totalFace = rows.reduce((s, r) => s + Number(r.face_value || 0), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>गुंतवणूक अहवाल (नमुना २५) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_investments', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>या वर्षात नोंदी नाहीत.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २५</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम १६ (१) व (२) आणि २२ (१) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>गुंतवणूक नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; (सन {currentYear?.year_label})</div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>अ. क्र.</th>
                <th rowSpan={2}>गुंतवणुकीची तारीख</th>
                <th rowSpan={2}>गुंतवणुकीचा तपशील (बँकेत मुदत ठेव/ राष्ट्रीय बचत प्रमाणपत्र/ सरकारी रोखे/ सहकारी व इतर क्रमांक व तारीख)</th>
                <th colSpan={2}>गुंतवणुकीची रक्कम</th>
                <th rowSpan={2}>परिणत होण्याची तारीख</th>
                <th rowSpan={2}>निव्वळ देय रक्कम</th>
                <th rowSpan={2}>उपार्जित व्याजाची तारीख</th>
                <th rowSpan={2}>सचिवांची सही</th>
              </tr>
              <tr><th>दर्शनी मूल्य</th><th>खरेदी किंमत</th></tr>
              <tr className="cl-numrow">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td>{fmtDate(r.investment_date)}</td>
                  <td className="cl-name">{r.description}</td>
                  <td className="num">{cell(r.face_value)}</td>
                  <td className="num">{fmt(r.purchase_price)}</td>
                  <td>{r.maturity_date ? fmtDate(r.maturity_date) : ''}</td>
                  <td className="num">{cell(r.matured_amount)}</td>
                  <td>{r.interest_date ? fmtDate(r.interest_date) : ''}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>अ. क्र.</th>
                <th>सरपंचाची सही</th>
                <th>बदलीचा/पदोन्नतीचा दिनांक</th>
                <th>दैनिक रोकड वहीतील जमा रक्कम</th>
                <th>प्रक्रांतीचा तपशील</th>
                <th>सचिवाची सही</th>
                <th>सरपंचाची सही</th>
              </tr>
              <tr className="cl-numrow"><th />{[10, 11, 12, 13, 14, 15].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td />
                  <td>{r.matured_on ? fmtDate(r.matured_on) : ''}</td>
                  <td className="num">{cell(r.matured_cash_amount)}</td>
                  <td className="cl-name">{r.remark || ''}</td>
                  <td /><td />
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <div style={{ textAlign: 'right', marginTop: 6, fontSize: 12 }}>
              एकूण दर्शनी मूल्य <strong>{fmt(totalFace)}</strong> &nbsp;|&nbsp; एकूण खरेदी किंमत <strong>{fmt(totalPurchase)}</strong>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
