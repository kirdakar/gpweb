import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  '१ जानेवारी', '२ फेब्रुवारी', '३ मार्च', '४ एप्रिल', '५ मे', '६ जून',
  '७ जुलै', '८ ऑगस्ट', '९ सप्टेंबर', '१० ऑक्टोबर', '११ नोव्हेंबर', '१२ डिसेंबर',
];

// नमुना २८ - मागासवर्गीयांसाठी १५% व महिला-बालकल्याण १०% करावयाचे खर्चाचे
// मासिक विवरण. उत्पन्नाच्या आधारावर लक्ष्य रक्कम विरुद्ध K1.20/K1.22 या
// शीर्षांखालील प्रत्यक्ष खर्चाचे योजनानिहाय (नोंदीनुसार) तपशील.
function Section({ title, section, targetLabel }) {
  if (!section) return <p>{title}: लेखाशीर्ष सापडले नाही</p>;
  const percentSpent = section.monthTotal && section.targetAmount ? round1((section.monthTotal / section.targetAmount) * 100) : 0;
  return (
    <div style={{ marginBottom: 24 }}>
      <h3>{title}</h3>
      <p>
        {targetLabel} लक्ष्य रक्कम: <strong>{section.targetAmount.toFixed(2)}</strong> ({section.targetPercent}%)
        {' | '}चालू महिन्यातील प्रत्यक्ष खर्च: <strong>{section.monthTotal.toFixed(2)}</strong> ({percentSpent}% लक्ष्याच्या तुलनेत)
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>दिनांक</th><th>संदर्भ</th><th>तपशील (योजना)</th><th className="num">रक्कम</th></tr></thead>
          <tbody>
            {section.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.entry_date?.slice(0, 10)}</td>
                <td>{e.reference_no || '-'}</td>
                <td>{e.narration || '-'}</td>
                <td className="num">{Number(e.amount).toFixed(2)}</td>
              </tr>
            ))}
            {section.entries.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>मागील महिन्यापर्यंतचा खर्च</td><td className="num">{section.priorTotal.toFixed(2)}</td></tr>
            <tr className="total-row"><td colSpan={3}>एकूण खर्च (मागील + चालू)</td><td className="num">{section.total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function round1(n) { return Math.round(n * 10) / 10; }

export default function WelfareExpenditureReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/welfare-expenditure', { params: { financialYearId: yearId, year, month } })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

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
        <div className="search-bar">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <button className="btn secondary" type="button" onClick={load}>दाखवा</button>
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>मागासवर्गीय १५% व महिला-बालकल्याण १०% मासिक खर्च विवरण (नमुना २८)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''} | महिना: {MONTHS[month - 1]} {year}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : data && (
        <>
          <p>चालू महिन्यातील एकूण जमा (उत्पन्न): <strong>{data.monthIncome.toFixed(2)}</strong></p>
          <Section title="मागासवर्गीय (१५%)" section={data.magasvargiy} targetLabel="१५%" />
          <Section title="महिला व बालकल्याण (१०%)" section={data.mahilaBal} targetLabel="१०%" />
        </>
      )}
    </div>
  );
}
