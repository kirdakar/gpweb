import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

function TaxDemandCard({ code, yearLabel, portions }) {
  const grandTotal = portions.reduce((s, p) => s + Number(p.total_tax || 0), 0);
  return (
    <div className="card print-page-break">
      <div className="print-header">
        <h2>ग्रामपंचायत — कर आकारणी पावती</h2>
        <p>आर्थिक वर्ष: {yearLabel} | कोड: {code}</p>
      </div>
      <p><strong>मालकाचे नाव:</strong> {portions[0]?.owner_name || '-'}</p>
      <p><strong>भोगवटादार:</strong> {portions[0]?.bhogvatdar || '-'}</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>मालमत्ता क्र.</th><th>बांधकाम प्रकार</th>
              <th className="num">घरपट्टी</th><th className="num">दिवाबत्ती</th><th className="num">आरोग्य</th><th className="num">पाणीपट्टी</th><th className="num">एकूण</th>
            </tr>
          </thead>
          <tbody>
            {portions.map((p) => (
              <tr key={p.property_id}>
                <td>{p.malmata_no ?? '-'}</td>
                <td>{p.construction_type_name || '-'}</td>
                <td className="num">{Number(p.gharpatti || 0).toFixed(2)}</td>
                <td className="num">{Number(p.divabatti || 0).toFixed(2)}</td>
                <td className="num">{Number(p.arogya || 0).toFixed(2)}</td>
                <td className="num">{Number(p.panipatti || 0).toFixed(2)}</td>
                <td className="num">{Number(p.total_tax || 0).toFixed(2)}</td>
              </tr>
            ))}
            {portions.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>या कोड साठी नोंदी नाहीत</td></tr>}
          </tbody>
          {portions.length > 0 && (
            <tfoot>
              <tr className="total-row">
                <td colSpan={6}>एकूण देय कर</td>
                <td className="num">{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function TaxDemandReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();

  // शोधा कंबोमध्ये कोड नंबरवर ग्रुप करून दाखवतो (एकदाच नाव, डबल-डबल नांवे
  // नकोत) - सुरुवातीस (काहीही टाइप न करताच) संपूर्ण यादी दिसते, इतर
  // रिपोर्टमधल्या शोधाप्रमाणेच.
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [code, setCode] = useState('');
  const [portions, setPortions] = useState(null);
  const [loading, setLoading] = useState(false);

  // संपूर्ण रिपोर्ट (सर्व कोड, किंवा कोड टप्प्यात) एकदम प्रिंट करण्याची सोय -
  // नमुना ८/९ क प्रमाणेच, कारण एकदम शेकडो कोड DOM मध्ये टाकले की ब्राउझरचा
  // प्रिंट पूर्वावलोकन तयार व्हायला वेळ लागतो (तो ब्राउझरचाच मूळ टप्पा आहे).
  const [bulkRows, setBulkRows] = useState(null);
  const [rangeMode, setRangeMode] = useState(null); // null | 'all' | {from, to}
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    client.get('/properties', { params: { page: 1, pageSize: 5000, yearId } }).then(({ data }) => setRows(data.data));
  }, [yearId]);

  useEffect(() => {
    setBulkRows(null);
    setRangeMode(null);
  }, [yearId]);

  const codeOptions = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (r.property_code == null) continue;
      if (!map.has(r.property_code)) {
        map.set(r.property_code, { property_code: r.property_code, owner_name: r.owner_name, malmata_nos: [] });
      }
      map.get(r.property_code).malmata_nos.push(r.malmata_no);
    }
    return [...map.values()].sort((a, b) => a.property_code - b.property_code);
  }, [rows]);

  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return codeOptions;
    return codeOptions.filter((o) =>
      (o.owner_name || '').toLowerCase().includes(searchTerm) ||
      o.malmata_nos.some((m) => String(m || '').toLowerCase().includes(searchTerm)) ||
      String(o.property_code).includes(searchTerm)
    );
  }, [codeOptions, searchTerm]);

  const codeNums = useMemo(() => rows.filter((r) => r.property_code != null).map((r) => Number(r.property_code)).filter(Number.isFinite), [rows]);
  const minCode = codeNums.length ? Math.min(...codeNums) : '';
  const maxCode = codeNums.length ? Math.max(...codeNums) : '';

  async function loadForCode(value) {
    setCode(value);
    setPortions(null);
    if (!value || !yearId) return;
    setLoading(true);
    try {
      const { data } = await client.get('/reports/tax-demand-by-code', { params: { code: value, yearId } });
      setPortions(data);
    } finally {
      setLoading(false);
    }
  }

  function selectCode(opt) {
    setSearch(`${opt.property_code} - ${opt.owner_name}`);
    setDropdownOpen(false);
    setRangeMode(null);
    loadForCode(opt.property_code);
  }

  function clearSearch() {
    setSearch('');
    setCode('');
    setPortions(null);
    setDropdownOpen(false);
  }

  // property-list कडून वर्षभरातील सर्व मालमत्तांची (ज्यांना त्या वर्षाची
  // आकारणी नोंद आहे) यादी एकदाच आणून कोडनुसार गट करतो - तेच आकडे जे
  // tax-demand-by-code प्रति-कोड परत करतो, त्यामुळे वेगळा बल्क राऊट लागत नाही.
  async function ensureBulkRows() {
    if (bulkRows) return bulkRows;
    const { data } = await client.get('/reports/property-list', { params: { yearId } });
    setBulkRows(data);
    return data;
  }

  const bulkGroups = useMemo(() => {
    if (!bulkRows) return [];
    const map = new Map();
    for (const r of bulkRows) {
      if (r.property_code == null) continue;
      if (!map.has(r.property_code)) map.set(r.property_code, []);
      map.get(r.property_code).push(r);
    }
    return [...map.entries()]
      .map(([c, ps]) => ({ code: c, portions: ps }))
      .sort((a, b) => a.code - b.code);
  }, [bulkRows]);

  const visibleGroups = rangeMode
    ? (rangeMode === 'all' ? bulkGroups : bulkGroups.filter((g) => g.code >= rangeMode.from && g.code <= rangeMode.to))
    : [];

  function applyRange(from, to) {
    setCode(''); setPortions(null); setSearch(''); setDropdownOpen(false);
    setGenerating(true);
    ensureBulkRows().then(() => setRangeMode({ from, to })).finally(() => setGenerating(false));
  }

  function handleShowAll() {
    setCode(''); setPortions(null); setSearch(''); setDropdownOpen(false);
    setGenerating(true);
    ensureBulkRows().then((data) => {
      const codeCount = new Set(data.map((r) => r.property_code).filter((c) => c != null)).size;
      const proceed = codeCount <= 150 || window.confirm(
        `सर्व ${codeCount} कोडची कर आकारणी पावती तयार करायची आहेत का? एवढ्या मोठ्या संख्येने ब्राउझरचा प्रिंट पूर्वावलोकन (preview) तयार व्हायला बराच वेळ लागू शकतो. त्याऐवजी कोड टप्प्याटप्प्याने (उदा. १-१००) छापण्याची शिफारस आहे.`
      );
      setRangeMode(proceed ? 'all' : null);
    }).finally(() => setGenerating(false));
  }

  function handleRangeSubmit(e) {
    e.preventDefault();
    const from = rangeFrom === '' ? minCode : Number(rangeFrom);
    const to = rangeTo === '' ? maxCode : Number(rangeTo);
    if (from > to) { window.alert('सुरुवातीचा कोड शेवटच्या कोड पेक्षा मोठा आहे.'); return; }
    applyRange(from, to);
  }

  function backToPicker() {
    setRangeMode(null);
  }

  const yearLabel = years.find((y) => y.id === yearId)?.year_label || '';

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर आकारणी पावती (Tax Demand Notice)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          {(portions || visibleGroups.length > 0) && (
            <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_tax_demand', 'print')}>प्रिंट</button>
          )}
          <CloseReportButton />
        </div>
      </div>

      {!rangeMode && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <div className="search-bar" style={{ alignItems: 'flex-start' }}>
            <div className="combo-wrap">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="कोड किंवा मालकाचे नाव टाइप करा - क्लिक केल्यावर संपूर्ण यादी दिसेल"
                style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
              />
              {search && (
                <button
                  type="button"
                  className="combo-clear-btn"
                  title="शोध पुसा"
                  onMouseDown={(e) => { e.preventDefault(); setSearch(''); setDropdownOpen(true); }}
                >
                  ×
                </button>
              )}
              {dropdownOpen && (
                <div className="combo-dropdown">
                  {searchResults.length === 0 && <div className="combo-empty">जुळणारी नोंद सापडली नाही</div>}
                  {searchResults.map((o) => (
                    <div key={o.property_code} className="combo-option" onMouseDown={() => selectCode(o)}>
                      {o.property_code} - {o.owner_name} <span style={{ color: 'var(--text-muted)' }}>(मालमत्ता: {o.malmata_nos.join(', ')})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn secondary" type="button" onClick={clearSearch} disabled={!search && !code && !portions}>शोध क्लिअर करा</button>
          </div>
          <form onSubmit={handleRangeSubmit} className="search-bar" style={{ marginTop: 10, marginBottom: 0 }}>
            <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>किंवा संपूर्ण रिपोर्ट कोड टप्प्यात प्रिंट करा:</span>
            <input type="number" placeholder={`पासून (${minCode})`} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
              style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
            <input type="number" placeholder={`पर्यंत (${maxCode})`} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
              style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
            <button className="btn secondary" type="submit" disabled={generating}>टप्पा तयार करा</button>
            <button className="btn secondary" type="button" onClick={handleShowAll} disabled={generating}>सर्व प्रिंट करा</button>
          </form>
        </div>
      )}

      {generating && <p>तयार होत आहे, कृपया थांबा...</p>}
      {rangeMode && !generating && (
        <p className="no-print" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {rangeMode === 'all' ? 'सर्व कोडची' : `कोड ${rangeMode.from} ते ${rangeMode.to} -`} {visibleGroups.length} कर आकारणी पावती तयार आहेत.
          {' '}<button className="btn secondary small" onClick={backToPicker}>परत यादीकडे जा</button>
        </p>
      )}

      {loading && <p>लोड होत आहे...</p>}

      {portions && !rangeMode && (
        <TaxDemandCard code={code} yearLabel={yearLabel} portions={portions} />
      )}

      {visibleGroups.map((g) => (
        <TaxDemandCard key={g.code} code={g.code} yearLabel={yearLabel} portions={g.portions} />
      ))}
    </div>
  );
}
