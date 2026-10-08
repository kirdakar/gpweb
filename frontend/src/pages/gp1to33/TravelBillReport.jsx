import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const cell = (n) => (Number(n) ? Number(n).toFixed(2) : '');
const W1 = [14, 10, 9, 7, 6, 9, 7, 6, 12, 6, 6, 8];
const W2 = [4, 8, 8, 10, 9, 8, 10, 23, 10, 10];

// नमुना ३१ [नियम २४(२)(ग)(२) पाहा] - प्रवास भत्ता देयक, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते - प्रत्येक प्रवाशासाठी (निवडलेल्या
// महिन्यात) एक पान (१: नाव, कार्यालयाचे ठिकाण, कार्यालयीन प्रवासाचा तपशील - निर्गमन/आगमन ठिकाण-दिनांक-वेळ, प्रवासाचे साधन, रेल्वे/बोटीचे वर्ग/
// तिकिटे/रक्कम; २: रस्त्याने/ट्रॉलीने मैल भत्ता - कि.मी./दर/रक्कम, दैनिक भत्ता - दिवस/दर/रक्कम, प्रवासाचे कारण, स्तंभांची बेरीज, शेरा). डाटाएंट्री
// TravelBillEntry.jsx वर; रकमा/बेरीज आपोआप, नोंद करताच रोकड वहीत खर्च पोस्ट झालेला असतो.
export default function TravelBillReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 0 = सर्व महिने
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/travel-bills', { params: { financialYearId: yearId } })
      .then(({ data }) => {
        const sorted = [...data].reverse(); // जुने आधी
        setRows(sorted);
        // चालू महिन्यात देयके नसतील तर शेवटच्या देयकाचा वर्ष/महिना आपोआप निवडतो (रिकामे पान दिसू नये)
        const nowY = new Date().getFullYear();
        const nowM = new Date().getMonth() + 1;
        const hasCurrent = sorted.some((r) => Number(String(r.travel_date).slice(0, 4)) === nowY && Number(String(r.travel_date).slice(5, 7)) === nowM);
        if (!hasCurrent && sorted.length) {
          const last = sorted[sorted.length - 1];
          setYear(Number(String(last.travel_date).slice(0, 4)));
          setMonth(Number(String(last.travel_date).slice(5, 7)));
        }
      })
      .finally(() => setLoading(false));
  }, [yearId]);

  // निवडलेल्या वर्ष/महिन्याची देयके, प्रवाशानुसार गट (प्रत्येकाचे स्वतंत्र पान)
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const y = Number(String(r.travel_date).slice(0, 4));
      const m = Number(String(r.travel_date).slice(5, 7));
      if (y !== year || (month !== 0 && m !== month)) continue;
      if (!map.has(r.traveller_name)) map.set(r.traveller_name, []);
      map.get(r.traveller_name).push(r);
    }
    return [...map.entries()].map(([name, list]) => ({ name, list }));
  }, [rows, year, month]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>प्रवास भत्ता देयक अहवाल (नमुना ३१) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={groups.length === 0 || !can('reports_travel_bills', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            <option value={0}>सर्व महिने</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && groups.length === 0 && <p>या कालावधीत प्रवास भत्ता देयके नाहीत.</p>}

      {!loading && groups.map(({ name, list }) => {
        const total = list.reduce((s, r) => s + Number(r.total_amount), 0);
        const office = list.find((r) => r.office_place)?.office_place;
        const sum = (k) => list.reduce((s, r) => s + Number(r[k] || 0), 0);
        const enclosures = list.map((r) => r.enclosures).filter(Boolean);
        return (
          <div key={name} className="a4-page cl-page">
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ३१</div>
            <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २४(२)(ग)(२) पाहा)</div>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>प्रवास भत्ता देयक</div>
            <div style={{ fontSize: 12, margin: '2px 0 6px', textAlign: 'center' }}>
              श्री. <strong>{name}</strong> यांचे {office ? <strong>{office}</strong> : '----------'} सन <strong>{year}</strong> या महिन्याचे{month ? <> (<strong>{MONTHS[month - 1]}</strong>)</> : ''} प्रवास भत्ता देयक
              &nbsp;— ग्रामपंचायत {gpName ? <strong>{gpName}</strong> : '..........'}
            </div>

            <table className="cl-table">
              <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th rowSpan={3}>सरपंच/ उपसरपंच/ सदस्य यांचे नाव</th>
                  <th rowSpan={3}>कार्यालयाचे ठिकाण</th>
                  <th colSpan={6}>कार्यालयीन प्रवासाचा तपशील</th>
                  <th rowSpan={3}>रेल्वे (मेल/पॅसेंजर) बोट, रस्त्यावरून धावणाऱ्या/ ट्रॉली यापैकी केलेल्या प्रवासाचे साधन</th>
                  <th colSpan={3}>रेल्वे/बोटीचे नाव</th>
                </tr>
                <tr><th colSpan={3}>निर्गमन</th><th colSpan={3}>आगमन</th><th rowSpan={2}>वर्ग</th><th rowSpan={2}>तिकिटांची संख्या</th><th rowSpan={2}>रक्कम</th></tr>
                <tr><th>ठिकाण</th><th>दिनांक</th><th>वेळ</th><th>ठिकाण</th><th>दिनांक</th><th>वेळ</th></tr>
                <tr className="cl-numrow">{Array.from({ length: 12 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} style={{ height: 32 }}>
                    <td className="cl-name">{r.traveller_name}</td>
                    <td className="cl-name">{r.office_place || ''}</td>
                    <td className="cl-name">{r.from_place || ''}</td>
                    <td>{r.travel_date ? fmtDate(r.travel_date) : ''}</td>
                    <td>{r.depart_time || ''}</td>
                    <td className="cl-name">{r.to_place || ''}</td>
                    <td>{(r.arrival_date || r.travel_date) ? fmtDate(r.arrival_date || r.travel_date) : ''}</td>
                    <td>{r.arrival_time || ''}</td>
                    <td className="cl-name">{[r.transport_mode, r.vehicle_name].filter(Boolean).join(' - ')}</td>
                    <td>{r.travel_class || ''}</td>
                    <td className="num">{r.ticket_count != null ? r.ticket_count : ''}</td>
                    <td className="num">{cell(r.fare_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="cl-table" style={{ marginTop: 8 }}>
              <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>अ. क्र.</th>
                  <th colSpan={3}>रस्त्याने किंवा ट्रॉलीने केलेल्या प्रवासाकरिता मेल भत्ता</th>
                  <th colSpan={3}>दैनिक भत्ता</th>
                  <th rowSpan={2}>प्रवासाचे कारण</th>
                  <th rowSpan={2}>प्रत्येक स्तंभाची बेरीज</th>
                  <th rowSpan={2}>शेरा</th>
                </tr>
                <tr><th>कि. मी.</th><th>दर</th><th>रक्कम</th><th>दिवसांची संख्या</th><th>दर</th><th>रक्कम</th></tr>
                <tr className="cl-numrow"><th />{Array.from({ length: 9 }, (_, i) => <th key={i}>({mnum(i + 13)})</th>)}</tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.id} style={{ height: 32 }}>
                    <td className="num">{mnum(i + 1)}</td>
                    <td className="num">{cell(r.mileage_km)}</td>
                    <td className="num">{cell(r.mileage_rate)}</td>
                    <td className="num">{cell(r.mileage_amount)}</td>
                    <td className="num">{cell(r.daily_allowance_days)}</td>
                    <td className="num">{cell(r.daily_allowance_rate)}</td>
                    <td className="num">{cell(r.daily_allowance_amount)}</td>
                    <td className="cl-name">{r.purpose || ''}</td>
                    <td className="num"><strong>{fmt(r.total_amount)}</strong></td>
                    <td className="cl-name">{r.remark || ''}</td>
                  </tr>
                ))}
                <tr className="cl-total" style={{ fontWeight: 700 }}>
                  <td>एकूण</td>
                  <td className="num">{cell(sum('mileage_km'))}</td><td />
                  <td className="num">{fmt(sum('mileage_amount'))}</td>
                  <td className="num">{cell(sum('daily_allowance_days'))}</td><td />
                  <td className="num">{fmt(sum('daily_allowance_amount'))}</td>
                  <td style={{ textAlign: 'right' }}>रेल्वे/बोट भाडे: {fmt(sum('fare_amount'))}</td>
                  <td className="num">{fmt(total)}</td><td />
                </tr>
              </tbody>
            </table>

            <div style={{ fontSize: 12, marginTop: 8 }}>मागणी केलेली एकूण रक्कम रुपये <strong>{fmt(total)}</strong> (अक्षरी {amountToMarathiWords(total)})</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              प्रमाणके : {enclosures.length ? enclosures.map((e, i) => `(${mnum(i + 1)}) ${e}`).join('   ') : '(१)  (२)  (३)  (४)'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 12 }}>
              <span>मागणीदाराची सही</span><span>नियंत्रक अधिकाऱ्याची सही</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
