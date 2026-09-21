import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// नमुना नं. ८ - आकारणी यादी (Assessment Register), the statutory Gram
// Panchayat form (was: access_anandnagar_report.rpt). One PAGE PER कोड
// (property_code) - जेव्हा एका कोडला अनेक मालमत्ता (portions) असतात, त्या
// त्याच पानावर जास्तीच्या ओळी म्हणून जोडल्या जातात (मूळ कागदी फॉर्म प्रमाणे),
// वेगळी पाने न होता. आधी हे गट अ.नं. (SRNO) प्रमाणे होत असत, आता कोड प्रमाणे
// (मालमत्ता क्रं. हा उप-गट, त्यामुळे एका व्यक्तीच्या सर्व मिळकती एकत्र येतात).
// Columns 1-12 in the top table, 13-27 in the bottom table, with the
// official numbered boxes under each header. पान क्रं. = the page's कोड.
//
// Columns with no equivalent field in this system (रस्त्याचे नांव, सिटी
// सर्व्हे नं., रेडिरेकनर दर - जमिन/ईमारत, अपिलांचे निकाल) render empty,
// same as the paper form leaves them for manual/future entry.
const TOP_COLUMNS = [
  { num: 1, label: 'अ.नं.', width: '5%', num_cls: true, render: (r) => r.property_code ?? '-' },
  { num: 2, label: 'रस्त्याचे नांव', width: '7%', render: () => '' },
  { num: 3, label: 'सिटी सर्व्हे नं.', width: '7%', render: () => '' },
  { num: 4, label: 'मालमत्ता क्रं.', width: '7%', render: (r) => r.malmata_no ?? '-' },
  { num: 5, label: 'मालकाचे नांव', width: '15%', render: (r) => r.owner_name },
  { num: 6, label: 'भोगवटादाराचे नांव', width: '11%', render: (r) => r.bhogvatdar || '-' },
  { num: 7, label: 'मालमत्तेचे वर्णन', width: '14%', render: (r) => r.particulars || r.construction_type_name || '-' },
  { num: 8, label: 'मिळकत बांधकामाचे वर्ष', width: '7%', render: (r) => r.milkat_year || '-' },
  { num: '9अ', label: 'क्षेत्रफळ चौ.फू.', width: '6%', num_cls: true, group: 'क्षेत्रफळ', render: (r) => Number(r.area_sqft || 0).toFixed(2) },
  { num: '9ब', label: 'क्षेत्रफळ चौ.मी.', width: '6%', num_cls: true, group: 'क्षेत्रफळ', render: (r) => Number(r.area_sqm || 0).toFixed(2) },
  { num: 10, label: 'जमिन', width: '5%', num_cls: true, group: 'रेडिरेकनर दर प्रती (चौ.मी.)', render: () => '' },
  { num: 11, label: 'ईमारत', width: '5%', num_cls: true, group: 'रेडिरेकनर दर प्रती (चौ.मी.)', render: () => '' },
  { num: 12, label: 'बांधकाम', width: '5%', num_cls: true, group: 'रेडिरेकनर दर प्रती (चौ.मी.)', render: (r) => Number(r.jamin_rate_used || 0).toFixed(2) },
];

const BOTTOM_COLUMNS = [
  { num: 13, label: 'घसारा दर', width: '5%', num_cls: true, render: (r) => Number(r.gasara_rate || 0).toFixed(3) },
  { num: 14, label: 'इमारतीच्या वापरानुसार भारांक', width: '7%', num_cls: true, render: (r) => Number(r.bharank || 0).toFixed(3) },
  { num: 15, label: 'भांडवली मुल्य ( रुपये )', width: '9%', num_cls: true, render: (r) => Number(r.bhandvalimula_rs || 0).toFixed(2) },
  { num: 16, label: 'कराचा दर ( पैसे )', width: '6%', num_cls: true, render: (r) => Number(r.karacha_rate || 0).toFixed(3) },
  { num: 17, label: 'घरपट्टी कर', width: '6%', num_cls: true, group: 'कराची रक्कम रुपये', render: (r) => Number(r.gharpatti || 0).toFixed(2) },
  { num: 18, label: 'दिवाबत्ती कर', width: '6%', num_cls: true, group: 'कराची रक्कम रुपये', render: (r) => Number(r.divabatti || 0).toFixed(2) },
  { num: 19, label: 'आरोग्य कर', width: '6%', num_cls: true, group: 'कराची रक्कम रुपये', render: (r) => Number(r.arogya || 0).toFixed(2) },
  { num: 20, label: 'पाणीपट्टी कर', width: '6%', num_cls: true, group: 'कराची रक्कम रुपये', render: (r) => Number(r.panipatti || 0).toFixed(2) },
  { num: 21, label: 'एकूण', width: '6%', num_cls: true, group: 'कराची रक्कम रुपये', render: (r) => Number(r.total_tax || 0).toFixed(2) },
  { num: 22, label: 'घरपट्टी कर', width: '5%', num_cls: true, group: 'अपिलांचे निकाल आणि त्यानंतर केलेले फेरफार', render: () => '' },
  { num: 23, label: 'दिवाबत्ती कर', width: '5%', num_cls: true, group: 'अपिलांचे निकाल आणि त्यानंतर केलेले फेरफार', render: () => '' },
  { num: 24, label: 'आरोग्य कर', width: '5%', num_cls: true, group: 'अपिलांचे निकाल आणि त्यानंतर केलेले फेरफार', render: () => '' },
  { num: 25, label: 'पाणीपट्टी कर', width: '5%', num_cls: true, group: 'अपिलांचे निकाल आणि त्यानंतर केलेले फेरफार', render: () => '' },
  { num: 26, label: 'एकूण', width: '5%', num_cls: true, group: 'अपिलांचे निकाल आणि त्यानंतर केलेले फेरफार', render: () => '' },
  { num: 27, label: 'नंतर वाढ किंवा घट झाल्यास त्याबाबतीत आदेशाच्या संदर्भासह शेरा ( टीप - शेरा व दुरुस्ती परिपंचाचे अनुक्रमणित करावयात )', width: '18%', render: (r) => r.narration || '' },
];

function groupSpans(columns) {
  const spans = [];
  for (const c of columns) {
    const key = c.group || null;
    const last = spans[spans.length - 1];
    if (key && last && last.key === key) last.span++;
    else spans.push({ key, span: 1 });
  }
  return spans;
}
const TOP_GROUPS = groupSpans(TOP_COLUMNS);
const BOTTOM_GROUPS = groupSpans(BOTTOM_COLUMNS);

function groupByCode(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.property_code ?? `__${r.property_id}`;
    if (!map.has(key)) map.set(key, { property_code: r.property_code, portions: [] });
    map.get(key).portions.push(r);
  }
  return [...map.values()];
}

function FormTable({ columns, groups, portions }) {
  return (
    <table className="register-table register-table-big">
      <colgroup>{columns.map((c) => <col key={c.num} style={{ width: c.width }} />)}</colgroup>
      <thead>
        <tr>{groups.map((g, i) => <th key={i} colSpan={g.span}>{g.key || ''}</th>)}</tr>
        <tr>{columns.map((c) => <th key={c.num} className={c.num_cls ? 'num' : undefined}>{c.label}</th>)}</tr>
        <tr className="col-number-row">{columns.map((c) => <th key={c.num}><span className="col-num-box">{c.num}</span></th>)}</tr>
      </thead>
      <tbody>
        {portions.map((row) => (
          <tr key={row.property_id}>{columns.map((c) => <td key={c.num} className={c.num_cls ? 'num' : undefined}>{c.render(row)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function RegisterPage({ page, settings, periodText }) {
  const gpLine = [settings.gp_name, settings.taluka ? `ता. ${settings.taluka}` : '', settings.district ? `जि. ${settings.district}` : '']
    .filter(Boolean).join(' ') || '(ग्रामपंचायतीचे नाव सेटिंग्जमध्ये नोंदवा)';
  return (
    <div className="a4-page">
      <div className="print-header">
        <p style={{ margin: '0 0 2px', fontSize: 15 }}>कारास पात्र असलेल्या इमारती व जमिनी यांची सन {periodText} साठी</p>
        <h2 style={{ margin: '0 0 8px' }}>आकारणी यादी ( असेसमेंट रजिस्टर )</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #000', padding: '4px 10px' }}>
          <strong style={{ border: '1px solid #000', padding: '2px 10px' }}>नमुना नं. ८</strong>
          <span>{gpLine}</span>
          <strong style={{ border: '1px solid #000', padding: '2px 10px' }}>पान क्रं. {page.property_code ?? '-'}</strong>
        </div>
      </div>
      <FormTable columns={TOP_COLUMNS} groups={TOP_GROUPS} portions={page.portions} />
      <FormTable columns={BOTTOM_COLUMNS} groups={BOTTOM_GROUPS} portions={page.portions} />
    </div>
  );
}

export default function AssessmentRegisterReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ gp_name: '', taluka: '', district: '' });
  const [periodText, setPeriodText] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // rangeMode = {from, to} (अ.नं. range) when printing a batch/all pages;
  // null means "just show whatever's picked from the search combo".
  const [rangeMode, setRangeMode] = useState(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    client.get('/settings').then(({ data }) => setSettings(data));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    const label = years.find((y) => y.id === yearId)?.year_label;
    if (label) setPeriodText(label);
  }, [yearId, years]);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    setRangeMode(null);
    setSelectedCode('');
    client.get('/reports/assessment-register', { params: { yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  // rows आधीच कोड, मालमत्ता क्र. प्रमाणे क्रमवार येतात (backend ORDER BY).
  const pages = useMemo(() => groupByCode(rows), [rows]);
  const codeNums = useMemo(() => pages.filter((p) => p.property_code != null).map((p) => Number(p.property_code)).filter(Number.isFinite), [pages]);
  const minCode = codeNums.length ? Math.min(...codeNums) : '';
  const maxCode = codeNums.length ? Math.max(...codeNums) : '';

  // कोड, मालमत्ता क्रं. किंवा नाव - यापैकी कशानेही टाइप करून शोधता यावे
  // म्हणून साधा <select> ऐवजी हा कंबो (टाइप करा + यादीतून निवडा). काहीही
  // टाइप न करताच क्लिक/फोकस केल्यावरही संपूर्ण यादी दिसावी (खरा combobox
  // अनुभव) - dropdown आधीच स्क्रोल होणारा (max-height) असल्याने पूर्ण यादी
  // दाखवली तरी अडचण नाही; टाइप केल्यावर ती फिल्टर होते. कोड नंबरवर ग्रुप
  // करून दाखवतो - एका कोडखाली अनेक मालमत्ता असल्या तरी नाव एकदाच दिसावे
  // (डबल-डबल नांवे नकोत) - एक पान = एक कोड असल्याने हे नैसर्गिकपणे जुळते.
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

  function selectCode(opt) {
    setSelectedCode(opt.property_code);
    setSearch(`${opt.property_code} - ${opt.owner_name}`);
    setDropdownOpen(false);
  }

  function clearSearch() {
    setSearch('');
    setSelectedCode('');
    setDropdownOpen(false);
  }

  // यादीतून एक मालमत्ता निवडली की तिचे संपूर्ण पान (त्या कोडच्या सर्व
  // मालमत्तांसह) रेंडर होते. मोठ्या रेंजसाठी (किंवा सर्व) DOM मध्ये शेकडो
  // A4 पाने टाकली की ब्राउझरचा प्रिंट-प्रीव्ह्यू तयार व्हायला वेळ लागतो -
  // तो ब्राउझरचाच मूळ (native) टप्पा आहे, तिथे आपण काही करू शकत नाही.
  // म्हणून एकाच वेळी सर्व न दाखवता कोडच्या टप्प्यात (range) छापण्याची
  // सोय दिली आहे - कमी पानांचा टप्पा = जलद प्रिंट प्रीव्ह्यू.
  const visiblePages = rangeMode
    ? pages.filter((p) => {
        if (p.property_code == null) return false;
        const c = Number(p.property_code);
        return Number.isFinite(c) && c >= rangeMode.from && c <= rangeMode.to;
      })
    : selectedCode !== ''
      ? pages.filter((p) => String(p.property_code) === String(selectedCode))
      : [];

  function applyRange(from, to) {
    setSelectedCode('');
    setSearch('');
    setGenerating(true);
    // "तयार होत आहेत" संदेश आधी दिसावा म्हणून जड टेबल-रेंडर एक क्षण पुढे ढकलतो.
    setTimeout(() => {
      setRangeMode({ from, to });
      setGenerating(false);
    }, 30);
  }

  function handleShowAll() {
    const proceed = pages.length <= 150 || window.confirm(
      `सर्व ${pages.length} पाने तयार करायची आहेत का? एवढ्या मोठ्या संख्येने ब्राउझरचा प्रिंट पूर्वावलोकन (preview) तयार व्हायला बराच वेळ लागू शकतो. त्याऐवजी कोड टप्प्याटप्प्याने (उदा. १-१००) छापण्याची शिफारस आहे.`
    );
    if (proceed) applyRange(minCode, maxCode);
  }

  function handleRangeSubmit(e) {
    e.preventDefault();
    const from = rangeFrom === '' ? minCode : Number(rangeFrom);
    const to = rangeTo === '' ? maxCode : Number(rangeTo);
    if (from > to) { window.alert('सुरुवातीचा कोड शेवटच्या कोड पेक्षा मोठा आहे.'); return; }
    applyRange(from, to);
  }

  return (
    <div className="assessment-register">
      <div className="page no-print" style={{ paddingBottom: 0 }}>
        <div className="page-header">
          <h1>आकारणी यादी (नमुना नं. ८)</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
            </select>
            <input style={{ width: 160, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
              value={periodText} onChange={(e) => setPeriodText(e.target.value)} placeholder="कालावधी उदा. 2025-26 ते 2028-29" />
            <button className="btn secondary" onClick={() => window.print()} disabled={visiblePages.length === 0 || generating || !can('reports_assessment_register', 'print')}>प्रिंट</button>
            <CloseReportButton />
          </div>
        </div>

        {loading ? <p>लोड होत आहे...</p> : (
          <>
            {!rangeMode && (
              <>
                <div className="search-bar" style={{ alignItems: 'flex-start' }}>
                  <div className="combo-wrap">
                    <input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setSelectedCode(''); setDropdownOpen(true); }}
                      onFocus={() => setDropdownOpen(true)}
                      placeholder="कोड, मालमत्ता क्रं. किंवा नाव टाइप करा - त्या कोडचे पान दिसेल"
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
                  <button className="btn secondary" type="button" onClick={clearSearch} disabled={!search && selectedCode === ''}>शोध क्लिअर करा</button>
                </div>
                <form onSubmit={handleRangeSubmit} className="search-bar">
                  <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>किंवा कोड टप्प्यात छापा:</span>
                  <input type="number" placeholder={`पासून (${minCode})`} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
                    style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
                  <input type="number" placeholder={`पर्यंत (${maxCode})`} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
                    style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
                  <button className="btn secondary" type="submit">टप्पा तयार करा</button>
                  <button className="btn secondary" type="button" onClick={handleShowAll}>सर्व {pages.length} पाने तयार करा</button>
                </form>
              </>
            )}
            {generating && <p>पाने तयार होत आहेत, कृपया थांबा...</p>}
            {rangeMode && !generating && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                कोड {rangeMode.from} ते {rangeMode.to} - {visiblePages.length} पाने तयार आहेत.
                {' '}<button className="btn secondary small" onClick={() => setRangeMode(null)}>परत यादीकडे जा</button>
              </p>
            )}
          </>
        )}
      </div>

      {visiblePages.map((page) => (
        <RegisterPage key={page.property_code ?? page.portions[0].property_id} page={page} settings={settings} periodText={periodText} />
      ))}
    </div>
  );
}
