import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  '१ जानेवारी', '२ फेब्रुवारी', '३ मार्च', '४ एप्रिल', '५ मे', '६ जून',
  '७ जुलै', '८ ऑगस्ट', '९ सप्टेंबर', '१० ऑक्टोबर', '११ नोव्हेंबर', '१२ डिसेंबर',
];

// नमुना ६ - लेखाशीर्षनिहाय मासिक वर्गीकृत नोंदवही. निवडलेल्या शीर्षाच्या
// निवडलेल्या महिन्यातील प्रत्येक दिवसाची बेरीज (नमुना ५ वरून काढलेली),
// अधिक मागील महिन्यांपर्यंतची चढती बेरीज.
export default function ClassifiedLedgerReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();

  const [heads, setHeads] = useState([]);
  const [entryType, setEntryType] = useState('जमा');
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState('');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === entryType), [heads, entryType]);
  const searchTerm = search.trim().toLowerCase();
  const results = useMemo(() => {
    if (!searchTerm) return leafHeads;
    return leafHeads.filter((h) => h.name.toLowerCase().includes(searchTerm) || h.code.toLowerCase().includes(searchTerm));
  }, [leafHeads, searchTerm]);

  function selectHead(h) {
    setSelectedHeadId(h.id);
    setSearch(`${h.code} - ${h.name}`);
    setDropdownOpen(false);
  }

  function load() {
    if (!selectedHeadId || !yearId) return;
    setLoading(true);
    client.get('/reports/ledger-classified', { params: { financialYearId: yearId, ledgerHeadId: selectedHeadId, year, month } })
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वर्गीकृत नोंदवही (नमुना ६)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!data || !can('reports_ledger_classified', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button type="button" className={`btn ${entryType === 'जमा' ? '' : 'secondary'}`} onClick={() => { setEntryType('जमा'); setSelectedHeadId(''); setSearch(''); }}>जमा</button>
          <button type="button" className={`btn ${entryType === 'खर्च' ? '' : 'secondary'}`} onClick={() => { setEntryType('खर्च'); setSelectedHeadId(''); setSearch(''); }}>खर्च</button>
        </div>
        <div className="search-bar" style={{ alignItems: 'flex-start' }}>
          <div className="combo-wrap">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedHeadId(''); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="लेखाशीर्ष टाइप करा - क्लिक केल्यावर संपूर्ण यादी दिसेल"
              style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
            />
            {search && (
              <button type="button" className="combo-clear-btn" title="शोध पुसा"
                onMouseDown={(e) => { e.preventDefault(); setSearch(''); setSelectedHeadId(''); setDropdownOpen(true); }}>×</button>
            )}
            {dropdownOpen && (
              <div className="combo-dropdown">
                {results.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
                {results.map((h) => <div key={h.id} className="combo-option" onMouseDown={() => selectHead(h)}>{h.code} - {h.name}</div>)}
              </div>
            )}
          </div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <button className="btn secondary" type="button" onClick={load} disabled={!selectedHeadId}>दाखवा</button>
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}

      {data && (
        <div className="card">
          <div className="print-header">
            <h2>{gpLine}</h2>
            <p style={{ fontWeight: 700 }}>लेखाशीर्षनिहाय मासिक वर्गीकृत नोंदवही (नमुना ६)</p>
            <p>आर्थिक वर्ष: {currentYear?.year_label || ''} | लेखाशीर्ष: {data.head.code} - {data.head.name} | महिना: {MONTHS[data.month - 1]} {data.year}</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>तारीख</th><th className="num">रक्कम</th></tr></thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <tr key={d}>
                    <td>{d}</td>
                    <td className="num">{Number(data.days[d] || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row"><td>महिन्याची एकूण रक्कम</td><td className="num">{data.monthTotal.toFixed(2)}</td></tr>
                <tr><td>मागील महिन्यापर्यंतची एकूण रक्कम</td><td className="num">{data.priorTotal.toFixed(2)}</td></tr>
                <tr className="total-row"><td>चढती बेरीज</td><td className="num">{data.runningTotal.toFixed(2)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
