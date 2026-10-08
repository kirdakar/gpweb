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
const PER_PAGE = 6;
const DAYS_A = Array.from({ length: 15 }, (_, i) => i + 1);
const DAYS_B = Array.from({ length: 16 }, (_, i) => i + 16);

// नमुना ६ - लेखाशीर्षनिहाय मासिक वर्गीकृत नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर: वरचा तक्ता = लेखा शीर्ष,
// अर्थसंकल्पीय अनुदान व तारखा १-१५; खालचा तक्ता = तारखा १६-३१, महिन्याची एकूण, आधीच्या महिन्या अखेरपर्यंतची एकूण
// व चढती बेरीज (दोन्ही तक्त्यांत ओळी एकाच शीर्षाच्या). सर्व रकमा नमुना ५ (रोकड वही) वरून आपोआप - हाताने भरायचे नाही.
export default function ClassifiedLedgerReport() {
  const { yearId } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

  const now = new Date();
  const [entryType, setEntryType] = useState('जमा');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/ledger-classified-all', { params: { financialYearId: yearId, year, month, entryType } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId, entryType, year, month]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((h) => {
      if (term && !(h.name.toLowerCase().includes(term) || h.code.toLowerCase().includes(term))) return false;
      return showEmpty || h.monthTotal !== 0 || h.priorTotal !== 0;
    });
  }, [rows, search, showEmpty]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < shown.length; i += PER_PAGE) out.push(shown.slice(i, i + PER_PAGE));
    return out;
  }, [shown]);

  const sum = (key) => shown.reduce((s, h) => s + Number(h[key] || 0), 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const what = entryType === 'जमा' ? 'जमा' : 'दिलेल्या';

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वर्गीकृत नोंदवही (नमुना ६)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={shown.length === 0 || !can('reports_ledger_classified', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn ${entryType === 'जमा' ? '' : 'secondary'}`} onClick={() => setEntryType('जमा')}>जमा</button>
          <button type="button" className={`btn ${entryType === 'खर्च' ? '' : 'secondary'}`} onClick={() => setEntryType('खर्च')}>खर्च</button>
        </div>
        <div className="search-bar" style={{ alignItems: 'center' }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="लेखाशीर्ष शोधा (नाव/कोड) - रिकामे = सर्व" style={{ flex: 1, minWidth: 200, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> नोंद नसलेली शीर्षेही
          </label>
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && shown.length === 0 && <p>या महिन्यात नोंद असलेले लेखाशीर्ष नाही.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ६</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम १९(७), २५(१), (२) व (३), ३२(५), ३३(२)(३) व (४) (च), ३४, ३५, ३६(२), ३८(२), ४२(४)(ख), ६३, ६६(२) आणि (४) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>
            सन <strong>{year}</strong> च्या <strong>{MONTHS[month - 1]}</strong> महिन्याबद्दल {what} रकमांची वर्गीकृत नोंदवही
          </div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'}</div>

          <table className="cl-table">
            <colgroup>
              <col style={{ width: '17%' }} /><col style={{ width: '10%' }} />
              {DAYS_A.map((d) => <col key={d} style={{ width: `${73 / 15}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>लेखा शीर्ष (अर्थसंकल्पात निर्दिष्ट केल्याप्रमाणे नाव)</th>
                <th rowSpan={2}>अर्थसंकल्पीय अनुदान</th>
                <th colSpan={15}>तारखा</th>
              </tr>
              <tr className="cl-numrow">{DAYS_A.map((d) => <th key={d}>({mnum(d)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((h) => (
                <tr key={h.id}>
                  <td className="cl-name">{h.code} {h.name}</td>
                  <td className="num">{cell(h.approved_amount)}</td>
                  {DAYS_A.map((d) => <td key={d} className="num cl-day">{cell(h.days[d])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 10 }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              {DAYS_B.map((d) => <col key={d} style={{ width: `${70 / 16}%` }} />)}
              <col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>शीर्ष</th>
                <th colSpan={16}>तारखा</th>
                <th rowSpan={2}>महिन्याची एकूण रक्कम</th>
                <th rowSpan={2}>आधीच्या महिन्या अखेर पर्यंतची एकूण रक्कम</th>
                <th rowSpan={2}>चढती बेरीज</th>
              </tr>
              <tr className="cl-numrow">{DAYS_B.map((d) => <th key={d} style={d > daysInMonth ? { opacity: 0.35 } : undefined}>({mnum(d)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((h) => (
                <tr key={h.id}>
                  <td className="cl-name">{h.code}</td>
                  {DAYS_B.map((d) => <td key={d} className="num cl-day">{cell(h.days[d])}</td>)}
                  <td className="num">{fmt(h.monthTotal)}</td>
                  <td className="num">{fmt(h.priorTotal)}</td>
                  <td className="num"><strong>{fmt(h.runningTotal)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 8, fontSize: 12 }}>
              <span>मागील महिन्याच्या अखेरपर्यंतची एकूण रक्कम <strong>{fmt(sum('priorTotal'))}</strong></span>
              <span>महिन्याची एकूण रक्कम <strong>{fmt(sum('monthTotal'))}</strong></span>
              <span>चढती बेरीज <strong>{fmt(sum('runningTotal'))}</strong></span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
