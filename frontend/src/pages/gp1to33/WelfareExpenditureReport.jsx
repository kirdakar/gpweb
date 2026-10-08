import { useEffect, useState } from 'react';
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
const WIDTHS = [11, 10, 10, 19, 10, 10, 10, 9, 11];

// नमुना २८ (नियम २५(७) पाहा) - मागासवर्गीयांसाठी १५ टक्के व महिला बाल कल्याण १० टक्के करावयाचे खर्चाचे मासिक विवरण, कागदी नमुन्याप्रमाणे A4
// आडव्या पानावर - प्रत्येक वर्गासाठी एक पान, ९ रकान्यांसह: (१) वर्षातील तरतूद (नमुना १), (२) चालू महिन्यातील उत्पन्न (नमुना ५ वरील एकूण जमा),
// (३) १५/१० टक्के खर्च करावयाची रक्कम, (४) खर्चाच्या बाबी (योजनानिहाय - नोंदीच्या तपशीलानुसार), (५) मागील महिन्यापर्यंतचा खर्च, (६) चालू
// महिन्यातील खर्च, (७) एकूण खर्च, (८) खर्चाची टक्केवारी (एकूण खर्च ÷ करावयाची रक्कम), (९) शेरा. सर्व आकडे नमुना १/५ वरून आपोआप.
function Page({ title, short, section, income, monthName, year, fyLabel, gpName, settings }) {
  const schemes = section ? section.schemes : [];
  const rows = Math.max(schemes.length, 1);
  const totalPrior = schemes.reduce((s, r) => s + r.prior, 0);
  const totalCurrent = schemes.reduce((s, r) => s + r.current, 0);
  const total = totalPrior + totalCurrent;
  const target = section ? section.targetAmount : 0;
  const pct = target > 0 ? Math.round((total / target) * 1000) / 10 : null;
  return (
    <div className="a4-page cl-page">
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २८</div>
      <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २५(७) पाहा)</div>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>
        मागासवर्गीयांसाठी १५ टक्के व महिला बाल कल्याण १० टक्के (किंवा त्यानंतर विहित केलेला) करावयाचे खर्चाचे मासिक विवरण
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>— {title} —</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '4px 0 6px' }}>
        <span>माहे <strong>{monthName}</strong> <strong>{year}</strong></span>
        <span>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</span>
      </div>

      {!section ? <p>लेखाशीर्ष सापडले नाही.</p> : (
        <table className="cl-table">
          <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead>
            <tr>
              <th>सन {fyLabel} मध्ये {short} केलेली तरतूद</th>
              <th>चालू महिन्यात प्राप्त झालेले उत्पन्न</th>
              <th>{mnum(section.targetPercent)} टक्के खर्च करावयाची रक्कम</th>
              <th>खर्चाच्या बाबी बाबवार/ योजनावार</th>
              <th>मागील महिन्यात झालेला खर्च</th>
              <th>चालू महिन्यात झालेला खर्च</th>
              <th>एकूण खर्च</th>
              <th>खर्चाची टक्केवारी</th>
              <th>शेरा</th>
            </tr>
            <tr className="cl-numrow">{Array.from({ length: 9 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => {
              const r = schemes[i];
              return (
                <tr key={i}>
                  {i === 0 && <td rowSpan={rows + 1} className="num">{fmt(section.budgetAmount)}</td>}
                  {i === 0 && <td rowSpan={rows + 1} className="num">{fmt(income)}</td>}
                  {i === 0 && <td rowSpan={rows + 1} className="num"><strong>{fmt(target)}</strong></td>}
                  <td className="cl-name">{r ? `(${mnum(i + 1)}) ${r.name}` : ''}</td>
                  <td className="num">{r ? cell(r.prior) : ''}</td>
                  <td className="num">{r ? cell(r.current) : ''}</td>
                  <td className="num">{r ? fmt(r.prior + r.current) : ''}</td>
                  <td />
                  <td />
                </tr>
              );
            })}
            <tr className="cl-total">
              <td style={{ textAlign: 'right', fontWeight: 700 }}>एकूण</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmt(totalPrior)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmt(totalCurrent)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmt(total)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{pct == null ? '' : `${pct}%`}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      <div style={{ fontSize: 12, marginTop: 14 }}>
        प्रति, मे. गटविकास अधिकारी पंचायत समिती {settings?.taluka ? <strong>{settings.taluka}</strong> : '-----------------'} यांना सादर
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 12 }}>
        <span>सचिवाची सही</span><span>सरपंचाची सही</span>
      </div>
    </div>
  );
}

export default function WelfareExpenditureReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/welfare-expenditure', { params: { financialYearId: yearId, year, month } })
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId, year, month]);

  const common = { income: data?.monthIncome || 0, monthName: MONTHS[month - 1], year, fyLabel: currentYear?.year_label || '', gpName, settings };

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मागासवर्गीय/महिला-बाल मासिक विवरण (नमुना २८)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!data || !can('reports_welfare_expenditure', 'print')}>प्रिंट</button>
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
      {!loading && data && (
        <>
          <Page title="मागासवर्गीय (१५%)" short="मागासवर्गीयांसाठी" section={data.magasvargiy} {...common} />
          <Page title="महिला व बालकल्याण (१०%)" short="महिला व बालकल्याणासाठी" section={data.mahilaBal} {...common} />
        </>
      )}
    </div>
  );
}
