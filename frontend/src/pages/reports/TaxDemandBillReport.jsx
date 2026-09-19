import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// नमुना नं. ९ (क) - कर मागणी बिल (Tax Demand Bill, Mumbai Gram Panchayat
// Act 1958 सेक्शन १२९ पो.क.(१)). A4 पोर्ट्रेट, एकाच पानावर एकच बिल दोन
// प्रतीत (कार्बन-कॉपीच्या जुन्या पद्धतीप्रमाणे). रक्कम आजवर जमा झालेली
// वजा करून उरलेली (शिल्लक) दाखवते - GET /api/payments/due-summary चे
// balance_by_component हेच आधीच जमा-वजा-केलेले आकडे देते (कर जमा भरणे
// स्क्रीनची तीच FIFO वाटप गणना: प्रथम थकबाकी, मग चालू वर्ष).
const COMPONENTS = [
  { key: 'gharpatti', label: 'घरपट्टी कर' },
  { key: 'divabatti', label: 'दिवाबत्ती कर' },
  { key: 'arogya', label: 'आरोग्य कर' },
  { key: 'panipatti', label: 'पाणीपट्टी कर' },
];

function BillCopy({ summary, settings, periodText, billNo, billDate }) {
  if (!summary) return null;
  const { property, balance_by_component: bal } = summary;
  const rows = COMPONENTS.map((c) => ({
    label: c.label,
    thakbaki: Number(bal[`previous_${c.key}`] || 0),
    chalu: Number(bal[`current_${c.key}`] || 0),
  }));
  const total = rows.reduce((acc, r) => {
    acc.thakbaki += r.thakbaki;
    acc.chalu += r.chalu;
    return acc;
  }, { thakbaki: 0, chalu: 0 });
  const gpLine = [settings.gp_name, settings.taluka ? `ता. ${settings.taluka}` : '', settings.district ? `जि. ${settings.district}` : '']
    .filter(Boolean).join(' ') || '(ग्रामपंचायतीचे नाव सेटिंग्जमध्ये नोंदवा)';

  return (
    <div className="bill-copy">
      <div className="bill-head">
        <div className="bill-form-no">नमुना नं. ९ (क)</div>
        <div className="bill-title">
          <h3>कर मागणी बिल</h3>
          <p>(मुंबई ग्रामपंचायत १९५८ चा कायदा कलम १२९ पो.क.(१)प्रमाणे)</p>
          <p>ग्रामपंचायत - {gpLine}</p>
        </div>
        <div className="bill-meta">
          <div>नंबर: {billNo}</div>
          <div>दिनांक: {billDate}</div>
        </div>
      </div>

      <div className="bill-owner">
        <div>श्री./सौ. <strong>{property.owner_name}</strong></div>
        <div>घर क्रं. <strong>{property.malmata_no ?? '-'}</strong></div>
      </div>
      <p className="bill-line">यांस कडून पुढील कराची रक्कम वसुली योग्य आहे.</p>

      <table className="bill-table">
        <thead>
          <tr>
            <th>सन {periodText}</th>
            <th className="num">थकबाकी</th>
            <th className="num">चालू</th>
            <th className="num">एकूण</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num">{r.thakbaki.toFixed(2)}</td>
              <td className="num">{r.chalu.toFixed(2)}</td>
              <td className="num">{(r.thakbaki + r.chalu).toFixed(2)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td>एकुण</td>
            <td className="num">{total.thakbaki.toFixed(2)}</td>
            <td className="num">{total.chalu.toFixed(2)}</td>
            <td className="num">{(total.thakbaki + total.chalu).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <p className="bill-line">
        हे बिल आपणास प्राप्त झाल्यापासुन देय रक्कमांचा भरणा १५ दिवसांचे आत करावा अन्यथा
        ग्रामपंचायत अधिनियमाच्या कलम क्रं. १२९(२) अन्वये आपल्यावर मागणी बजावण्यास येईल.
      </p>

      <div className="bill-sign-row">
        <div>बील मिळालेबद्दल सही</div>
        <div>वसुली लिपिक</div>
        <div>ग्रामसेवक</div>
      </div>

      <div className="bill-footnote">
        <p>टीप. १) या पावतीचा नमुना कार्बनकॉपी प्रतिलिपीत असावा</p>
        <p>२) नमुना देण्यात येतील तेव्हा त्यावर पुस्तकाचे क्रमांक छापलेले असावेत</p>
      </div>
    </div>
  );
}

export default function TaxDemandBillReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState({ gp_name: '', taluka: '', district: '' });
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [periodText, setPeriodText] = useState('');
  const [billNo, setBillNo] = useState('1');
  const [billDate, setBillDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  });
  // एका वेळी एक मालमत्ता निवडण्याऐवजी थकबाकी/चालू देय असलेल्या मालमत्तांची
  // बिले टप्प्याटप्प्याने (कोड range) किंवा सर्व एकदम तयार करण्याची सोय -
  // नमुना नं. ८ प्रमाणेच, कारण एकदम शेकडो बिले DOM मध्ये टाकली की ब्राउझरचा
  // प्रिंट पूर्वावलोकन तयार व्हायला खूप वेळ लागतो (तो ब्राउझरचाच मूळ टप्पा
  // आहे, आपण तिथे काही करू शकत नाही) - कमी पानांचा टप्पा = जलद प्रिंट.
  const [bulkSummaries, setBulkSummaries] = useState(null);
  const [rangeMode, setRangeMode] = useState(null); // null | 'all' | {from, to}
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [generating, setGenerating] = useState(false);
  // बिले तयार झाल्यावर त्यातल्या एका विशिष्ट मालमत्तेचे बिल शोधण्यासाठी -
  // पुन्हा टप्पा/सर्व तयार न करता आधीच तयार असलेल्या यादीत फिल्टर करते.
  const [resultFilter, setResultFilter] = useState('');

  useEffect(() => {
    client.get('/settings').then(({ data }) => setSettings(data));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    const label = years.find((y) => y.id === yearId)?.year_label;
    if (label) setPeriodText(label);
  }, [yearId, years]);

  // शोधासाठी सर्व मालमत्ता एकदाच आणतो (नमुना नं. ८ प्रमाणेच combo).
  useEffect(() => {
    client.get('/properties', { params: { page: 1, pageSize: 5000 } }).then(({ data }) => setRows(data.data));
  }, [yearId]);

  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return rows;
    return rows.filter((r) =>
      (r.owner_name || '').toLowerCase().includes(searchTerm) ||
      String(r.malmata_no || '').toLowerCase().includes(searchTerm) ||
      String(r.property_code ?? '').includes(searchTerm)
    );
  }, [rows, searchTerm]);

  const codeNums = useMemo(() => rows.filter((r) => r.property_code != null).map((r) => Number(r.property_code)).filter(Number.isFinite), [rows]);
  const minCode = codeNums.length ? Math.min(...codeNums) : '';
  const maxCode = codeNums.length ? Math.max(...codeNums) : '';

  const visibleSummaries = useMemo(() => {
    if (!bulkSummaries || !rangeMode) return [];
    if (rangeMode === 'all') return bulkSummaries;
    return bulkSummaries.filter((s) => {
      if (s.property.property_code == null) return false;
      const code = Number(s.property.property_code);
      return Number.isFinite(code) && code >= rangeMode.from && code <= rangeMode.to;
    });
  }, [bulkSummaries, rangeMode]);

  const resultFilterTerm = resultFilter.trim().toLowerCase();
  const filteredSummaries = useMemo(() => {
    if (!resultFilterTerm) return visibleSummaries;
    return visibleSummaries.filter((s) =>
      (s.property.owner_name || '').toLowerCase().includes(resultFilterTerm) ||
      String(s.property.malmata_no || '').toLowerCase().includes(resultFilterTerm) ||
      String(s.property.property_code ?? '').includes(resultFilterTerm)
    );
  }, [visibleSummaries, resultFilterTerm]);

  // एकदम अनेक बिले तयार करताना प्रत्येकाला वेगळा, वाढत जाणारा बिल नंबर हवा
  // (१, २, ३...) - "नंबर" इनपुट फक्त सुरुवातीचा आकडा ठरवतो. नंबर मूळ
  // (अनफिल्टर्ड) यादीतल्या क्रमानुसार ठरतो, त्यामुळे शोध फिल्टर लावला तरी
  // एकाच मालमत्तेचा नंबर स्थिर राहतो.
  const billNoByPropertyId = useMemo(() => {
    const start = parseInt(billNo, 10) || 1;
    const map = new Map();
    visibleSummaries.forEach((s, i) => map.set(s.property.property_id, start + i));
    return map;
  }, [visibleSummaries, billNo]);

  function selectProperty(r) {
    setSelectedId(r.id);
    setSearch(`${r.property_code ?? '-'} / ${r.malmata_no ?? '-'} - ${r.owner_name}`);
    setDropdownOpen(false);
  }

  function clearSearch() {
    setSearch('');
    setSelectedId('');
    setSummary(null);
    setDropdownOpen(false);
  }

  useEffect(() => {
    if (!selectedId || !yearId) { setSummary(null); return; }
    setLoading(true);
    client.get('/payments/due-summary', { params: { propertyId: selectedId, yearId } })
      .then(({ data }) => setSummary(data))
      .finally(() => setLoading(false));
  }, [selectedId, yearId]);

  useEffect(() => {
    setBulkSummaries(null);
    setRangeMode(null);
  }, [yearId]);

  function ensureBulkSummaries() {
    if (bulkSummaries) return Promise.resolve(bulkSummaries);
    return client.get('/payments/due-summary-bulk', { params: { yearId } })
      .then(({ data }) => { setBulkSummaries(data.summaries); return data.summaries; });
  }

  function handleShowAllBills() {
    setSelectedId(''); setSearch(''); setSummary(null); setDropdownOpen(false);
    setResultFilter('');
    setGenerating(true);
    ensureBulkSummaries().then((summaries) => {
      const proceed = summaries.length <= 150 || window.confirm(
        `सर्व ${summaries.length} मालमत्तांची बिले तयार करायची आहेत का? एवढ्या मोठ्या संख्येने ब्राउझरचा प्रिंट पूर्वावलोकन (preview) तयार व्हायला बराच वेळ लागू शकतो. त्याऐवजी कोड टप्प्याटप्प्याने (उदा. १-१००) छापण्याची शिफारस आहे.`
      );
      setRangeMode(proceed ? 'all' : null);
    }).finally(() => setGenerating(false));
  }

  function handleRangeSubmit(e) {
    e.preventDefault();
    setSelectedId(''); setSearch(''); setSummary(null); setDropdownOpen(false);
    setResultFilter('');
    setGenerating(true);
    ensureBulkSummaries().then(() => {
      const from = rangeFrom === '' ? minCode : Number(rangeFrom);
      const to = rangeTo === '' ? maxCode : Number(rangeTo);
      if (from > to) { window.alert('सुरुवातीचा कोड शेवटच्या कोड पेक्षा मोठा आहे.'); return; }
      setRangeMode({ from, to });
    }).finally(() => setGenerating(false));
  }

  function backToPicker() {
    setRangeMode(null);
    setResultFilter('');
  }

  return (
    <div className="tax-demand-bill">
      <div className="page no-print" style={{ paddingBottom: 0 }}>
        <div className="page-header">
          <h1>कर मागणी बिल (नमुना नं. ९ क)</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
            </select>
            <button className="btn secondary" onClick={() => window.print()} disabled={(!summary && filteredSummaries.length === 0) || !can('reports_tax_demand_bill', 'print')}>प्रिंट</button>
            <CloseReportButton />
          </div>
        </div>

        {!rangeMode && (
          <>
            <div className="search-bar" style={{ alignItems: 'flex-start' }}>
              <div className="combo-wrap">
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedId(''); setSummary(null); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="कोड, मालमत्ता क्रं. किंवा नाव टाइप करा"
                  style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
                />
                {dropdownOpen && (
                  <div className="combo-dropdown">
                    {searchResults.length === 0 && <div className="combo-empty">जुळणारी नोंद सापडली नाही</div>}
                    {searchResults.map((r) => (
                      <div key={r.id} className="combo-option" onMouseDown={() => selectProperty(r)}>
                        {r.property_code ?? '-'} / {r.malmata_no ?? '-'} - {r.owner_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn secondary" type="button" onClick={clearSearch} disabled={!search && !selectedId}>शोध क्लिअर करा</button>
              <input style={{ width: 100, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
                value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="सुरुवातीचा नंबर" title="अनेक बिले तयार करताना प्रत्येक बिलाला हा आकडा सुरुवात धरून १, २, ३... असा वाढत जाणारा नंबर दिला जातो" />
              <input style={{ width: 120, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
                value={billDate} onChange={(e) => setBillDate(e.target.value)} placeholder="दिनांक" />
              <input style={{ width: 160, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
                value={periodText} onChange={(e) => setPeriodText(e.target.value)} placeholder="कालावधी उदा. 2025-26 ते 2028-29" />
            </div>
            <form onSubmit={handleRangeSubmit} className="search-bar">
              <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>किंवा कोड टप्प्यात बिले तयार करा:</span>
              <input type="number" placeholder={`पासून (${minCode})`} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
                style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
              <input type="number" placeholder={`पर्यंत (${maxCode})`} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
                style={{ width: 110, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
              <button className="btn secondary" type="submit" disabled={generating}>टप्पा तयार करा</button>
              <button className="btn secondary" type="button" onClick={handleShowAllBills} disabled={generating}>सर्व बिले तयार करा</button>
            </form>
          </>
        )}
        {(loading || generating) && <p>{generating ? 'बिले तयार होत आहेत, कृपया थांबा...' : 'लोड होत आहे...'}</p>}
        {rangeMode && !generating && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {rangeMode === 'all' ? 'सर्व मालमत्तांची' : `कोड ${rangeMode.from} ते ${rangeMode.to} -`} {visibleSummaries.length} बिले तयार आहेत.
              {' '}<button className="btn secondary small" onClick={backToPicker}>परत यादीकडे जा</button>
            </p>
            <div className="search-bar">
              <input
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                placeholder="तयार झालेल्या बिलांमध्ये कोड, मालमत्ता क्रं. किंवा नाव टाइप करून शोधा"
                style={{ width: '100%', maxWidth: 480, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
              />
              {resultFilterTerm && (
                <>
                  <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{filteredSummaries.length} जुळणारी बिले</span>
                  <button className="btn secondary" type="button" onClick={() => setResultFilter('')}>शोध क्लिअर करा</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {summary && (
        <div className="a4-page bill-page">
          <BillCopy summary={summary} settings={settings} periodText={periodText} billNo={billNo} billDate={billDate} />
          <div className="bill-cut-line" />
          <BillCopy summary={summary} settings={settings} periodText={periodText} billNo={billNo} billDate={billDate} />
        </div>
      )}

      {filteredSummaries.map((s) => (
        <div key={s.property.property_id} className="a4-page bill-page">
          <BillCopy summary={s} settings={settings} periodText={periodText} billNo={billNoByPropertyId.get(s.property.property_id)} billDate={billDate} />
          <div className="bill-cut-line" />
          <BillCopy summary={s} settings={settings} periodText={periodText} billNo={billNoByPropertyId.get(s.property.property_id)} billDate={billDate} />
        </div>
      ))}
    </div>
  );
}
