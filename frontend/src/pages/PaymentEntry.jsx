import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import { amountToMarathiWords } from '../utils/numberToMarathiWords';

// घरपट्टी पावती (नमुना नं. १०) = घरपट्टी + दिवाबत्ती(वीज कर) + आरोग्य कर,
// पाणीपट्टी पावती (नमुना नं. १०, वेगळे पुस्तक) = फक्त पाणी पट्टी - दोन्ही
// आता स्वतंत्र पावती-मालिका (receipt_type), स्वतंत्र वाढत जाणारा receipt_no,
// आणि स्वतंत्र FIFO वाटप (पहा backend utils/dueAllocation.js).
const GROUP_COMPONENTS = {
  gharpatti: [
    { key: 'gharpatti', label: 'घरपट्टी' },
    { key: 'divabatti', label: 'दिवाबत्ती (वीज कर)' },
    { key: 'arogya', label: 'आरोग्य कर' },
  ],
  panipatti: [
    { key: 'panipatti', label: 'पाणी पट्टी' },
  ],
};
const RECEIPT_LABELS = { gharpatti: 'घरपट्टी पावती', panipatti: 'पाणीपट्टी पावती' };

// खुली जागा कर/नोटीस फी/वारंट फी/इतर - या घटकांची वर्षनिहाय आकारणी प्रणालीत
// नाही (property_tax_assessment मध्ये नाहीत), त्यामुळे यांची बाकी आपोआप
// काढता येत नाही - दर पावतीच्या वेळी प्रत्यक्ष घेतलेली रक्कम इथे थेट
// नोंदवायची (जमा रकमेत मिळून) आणि पावतीवर स्वतंत्र छापायची.
const EXTRA_FIELDS = {
  gharpatti: [
    { key: 'khuli_jaga', label: 'खुली जागा कर' },
    { key: 'notice_fee', label: 'नोटीस फी' },
    { key: 'warrant_fee', label: 'वारंट फी' },
  ],
  panipatti: [
    { key: 'notice_fee', label: 'नोटीस फी' },
    { key: 'other', label: 'इतर' },
  ],
};
const emptyExtras = { khuli_jaga: '', notice_fee: '', warrant_fee: '', other: '' };
const PAYMENT_MODES = [
  { key: 'cash', label: 'कॅश' },
  { key: 'cheque', label: 'चेक / डी.डी.' },
  { key: 'upi', label: 'UPI' },
];

export default function PaymentEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  // कोड/मालमत्ता क्रं./नाव टाइप करून शोधणारा combo - सुरुवातीस (काहीही टाइप
  // न करताच) संपूर्ण यादी दिसावी म्हणून इतर स्क्रीनसारखीच संपूर्ण यादी
  // एकदाच आणून क्लायंटवरच शोधतो (backend search-per-keystroke ऐवजी).
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const [receiptType, setReceiptType] = useState('gharpatti');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [amount, setAmount] = useState('');
  const [extras, setExtras] = useState(emptyExtras);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [bankName, setBankName] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  useEffect(() => {
    client.get('/properties', { params: { page: 1, pageSize: 5000, yearId } }).then(({ data }) => setRows(data.data));
  }, [yearId]);

  async function loadSummary(propertyId, type, { resetReceipt = true } = {}) {
    if (resetReceipt) setLastReceipt(null);
    setError('');
    setLoadingSummary(true);
    try {
      const { data } = await client.get('/payments/due-summary', { params: { propertyId, yearId, receiptType: type } });
      setSummary(data);
      setAmount('');
      setExtras(emptyExtras);
      setPaymentMode('cash');
      setBankName('');
      setChequeNo('');
    } catch (err) {
      setError(err.response?.data?.error || 'माहिती आणताना त्रुटी आली');
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  function selectProperty(r) {
    setSelectedProperty(r);
    setSearch(`${r.property_code ?? '-'} / ${r.malmata_no ?? '-'} - ${r.owner_name}`);
    setDropdownOpen(false);
    setReceiptType('gharpatti');
    loadSummary(r.id, 'gharpatti');
  }

  function clearSearch() {
    setSearch('');
    setSelectedProperty(null);
    setSummary(null);
    setLastReceipt(null);
    setDropdownOpen(false);
  }

  function switchReceiptType(type) {
    setReceiptType(type);
    if (selectedProperty) loadSummary(selectedProperty.id, type);
  }

  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return rows;
    return rows.filter((r) =>
      (r.owner_name || '').toLowerCase().includes(searchTerm)
      || String(r.malmata_no || '').toLowerCase().includes(searchTerm)
      || String(r.property_code ?? '').includes(searchTerm)
    );
  }, [rows, searchTerm]);

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    const amt = Number(amount || 0);
    if (amt > summary.balance_due + 0.004) {
      setError(`कराची जमा रक्कम येणे बाकी (₹${summary.balance_due.toFixed(2)}) पेक्षा जास्त भरता येणार नाही`);
      return;
    }
    const extraAmts = Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, Number(v || 0)]));
    const totalCollected = amt + Object.values(extraAmts).reduce((s, v) => s + v, 0);
    if (totalCollected <= 0) {
      setError('कृपया किमान एका रकमेत काहीतरी टाका');
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post('/payments', {
        property_id: summary.property.property_id,
        financial_year_id: yearId,
        payment_date: paymentDate,
        amount: amt,
        receipt_type: receiptType,
        khuli_jaga_amount: extraAmts.khuli_jaga || 0,
        notice_fee_amount: extraAmts.notice_fee || 0,
        warrant_fee_amount: extraAmts.warrant_fee || 0,
        other_amount: extraAmts.other || 0,
        payment_mode: paymentMode,
        bank_name: bankName,
        cheque_no: chequeNo,
        narration,
      });
      setNarration('');
      await loadSummary(summary.property.property_id, receiptType, { resetReceipt: false });
      setLastReceipt(data);
    } catch (err) {
      setError(err.response?.data?.error || 'जमा करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid(paymentId) {
    if (!window.confirm('ही पावती रद्द (मिटवायची) करायची आहे का? ही क्रिया परत करता येणार नाही.')) return;
    await client.delete(`/payments/${paymentId}`);
    loadSummary(summary.property.property_id, receiptType);
  }

  const components = GROUP_COMPONENTS[receiptType];
  const extraFields = EXTRA_FIELDS[receiptType];

  return (
    <div className="page">
      <div className="page-header">
        <h1>कर जमा भरणे {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ alignItems: 'flex-start' }}>
          <div className="combo-wrap">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedProperty(null); setSummary(null); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="मालकाचे नाव, मालमत्ता क्र. किंवा कोड टाइप करा - क्लिक केल्यावर संपूर्ण यादी दिसेल"
              style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
              autoFocus
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
          <button className="btn secondary" type="button" onClick={clearSearch} disabled={!search && !selectedProperty}>शोध क्लिअर करा</button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loadingSummary && <p>लोड होत आहे...</p>}

      {summary && (
        <>
          <div className="card no-print" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, marginTop: 0 }}>
              {summary.property.owner_name} — मालमत्ता क्र. {summary.property.malmata_no ?? '-'} (कोड {summary.property.property_code ?? '-'})
            </h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {Object.keys(RECEIPT_LABELS).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`btn ${receiptType === type ? '' : 'secondary'}`}
                  onClick={() => switchReceiptType(type)}
                >
                  {RECEIPT_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {components.map((c) => <th key={c.key} className="num">{c.label}</th>)}
                    <th className="num">एकूण</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>मागील बाकी (देय)</td>
                    {components.map((c) => <td key={c.key} className="num">{Number(summary.property[`previous_${c.key}`] || 0).toFixed(2)}</td>)}
                    <td className="num">{components.reduce((s, c) => s + Number(summary.property[`previous_${c.key}`] || 0), 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>चालू वर्ष (देय)</td>
                    {components.map((c) => <td key={c.key} className="num">{Number(summary.property[`current_${c.key}`] || 0).toFixed(2)}</td>)}
                    <td className="num">{components.reduce((s, c) => s + Number(summary.property[`current_${c.key}`] || 0), 0).toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: 'var(--success)' }}>
                    <td>आजवर जमा (वसूल)</td>
                    {components.map((c) => (
                      <td key={c.key} className="num">
                        {(Number(summary.paid_by_component[`previous_${c.key}`] || 0) + Number(summary.paid_by_component[`current_${c.key}`] || 0)).toFixed(2)}
                      </td>
                    ))}
                    <td className="num">{summary.total_paid.toFixed(2)}</td>
                  </tr>
                  <tr className="total-row">
                    <td>उर्वरित बाकी</td>
                    {components.map((c) => (
                      <td key={c.key} className="num">
                        {(Number(summary.balance_by_component[`previous_${c.key}`] || 0) + Number(summary.balance_by_component[`current_${c.key}`] || 0)).toFixed(2)}
                      </td>
                    ))}
                    <td className="num">{summary.balance_due.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {summary.unallocated_advance > 0 && (
              <div className="notice-box">
                {RECEIPT_LABELS[receiptType]}पोटी सर्व देय रक्कम भरून झाली असून ₹{summary.unallocated_advance.toFixed(2)} जास्त (आगाऊ) जमा आहे.
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              वसुली क्रम: प्रथम मागील बाकी, नंतर चालू वर्ष ({components.map((c) => c.label).join(' → ')} याच क्रमाने).
              घरपट्टी व पाणीपट्टी यांचे वाटप एकमेकांपासून पूर्णपणे स्वतंत्र आहे.
            </p>
          </div>

          {can('payments', 'add') && (
            <div className="card no-print" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, marginTop: 0 }}>नवीन जमा नोंद — {RECEIPT_LABELS[receiptType]}</h2>
              <form onSubmit={handlePay}>
                <div className="form-grid">
                  <div className="field">
                    <label>दिनांक</label>
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>कराची जमा रक्कम ({components.map((c) => c.label).join('+')}) — जास्तीत जास्त ₹{summary.balance_due.toFixed(2)}</label>
                    <input type="number" step="0.01" min="0" max={summary.balance_due} value={amount}
                      onChange={(e) => setAmount(e.target.value)} autoFocus />
                  </div>
                  {extraFields.map((f) => (
                    <div className="field" key={f.key}>
                      <label>{f.label}</label>
                      <input type="number" step="0.01" min="0" value={extras[f.key]}
                        onChange={(e) => setExtras({ ...extras, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <div className="field">
                    <label>जमा प्रकार</label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                      {PAYMENT_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  {paymentMode === 'cheque' && (
                    <>
                      <div className="field">
                        <label>बँकेचे नांव</label>
                        <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>चेक क्र.</label>
                        <input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
                      </div>
                    </>
                  )}
                  <div className="field">
                    <label>शेरा</label>
                    <input value={narration} onChange={(e) => setNarration(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <button className="btn" type="submit" disabled={busy}>जमा करा व पावती तयार करा</button>
                </div>
              </form>
            </div>
          )}

          {lastReceipt && <ReceiptCard receipt={lastReceipt} property={summary.property} receiptType={receiptType} settingsYear={summary.year} canPrint={can('payments', 'print')} />}

          <div className="card no-print">
            <h2 style={{ fontSize: 15, marginTop: 0 }}>{RECEIPT_LABELS[receiptType]} इतिहास</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>पावती क्र.</th><th>दिनांक</th><th>वर्ष</th><th className="num">रक्कम</th><th>शेरा</th><th></th></tr></thead>
                <tbody>
                  {summary.history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.receipt_no}</td>
                      <td>{h.payment_date}</td>
                      <td>{h.year_label}</td>
                      <td className="num">
                        {(Number(h.amount) + Number(h.khuli_jaga_amount || 0) + Number(h.notice_fee_amount || 0)
                          + Number(h.warrant_fee_amount || 0) + Number(h.other_amount || 0)).toFixed(2)}
                      </td>
                      <td>{h.narration || '-'}</td>
                      <td>{can('payments', 'delete') && <button className="btn danger small" onClick={() => handleVoid(h.id)}>रद्द करा</button>}</td>
                    </tr>
                  ))}
                  {summary.history.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>अद्याप जमा नोंद नाही</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// प्रत्यक्ष कागदी नमुना नं. १० पावतीच्या मांडणीशी जुळणारे - प्रत्येक घटक
// एक ओळ (मागील बाकी | चालू कर | एकूण कर रुपये), अक्षरी रु., जमा प्रकार,
// आणि सही/तारीख ओळी.
function ReceiptCard({ receipt, property, receiptType, settingsYear, canPrint }) {
  const components = GROUP_COMPONENTS[receiptType];
  const extraFields = EXTRA_FIELDS[receiptType];
  const p = receipt.payment;
  const taxTotal = Number(receipt.amount || 0);
  const extrasTotal = extraFields.reduce((s, f) => s + Number(p[`${f.key}_amount`] || 0), 0);
  const grandTotal = taxTotal + extrasTotal;

  const rows = [
    ...components.map((c) => ({
      label: c.label,
      previous: Number(receipt.coveredByThisReceipt[`previous_${c.key}`] || 0),
      current: Number(receipt.coveredByThisReceipt[`current_${c.key}`] || 0),
    })),
    ...extraFields.map((f) => ({
      label: f.label,
      previous: 0,
      current: Number(p[`${f.key}_amount`] || 0),
    })),
  ];
  const totalPrevious = rows.reduce((s, r) => s + r.previous, 0);
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: 'var(--success)' }}>
      <div className="print-header">
        <p style={{ margin: 0, fontSize: 12 }}>नमुना नं. १० (नियम ३२(५) पहा)</p>
        <h2 style={{ margin: '2px 0' }}>ग्रामपंचायत — {RECEIPT_LABELS[receiptType]}</h2>
        <p style={{ margin: 0 }}>पावती नं. {p.receipt_no} | दिनांक: {p.payment_date} | आर्थिक वर्ष: {p.year_label}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
        <p style={{ margin: 0 }}><strong>नांव:</strong> {property.owner_name}</p>
        <p style={{ margin: 0 }}><strong>घर नं.:</strong> {property.malmata_no ?? '-'}</p>
      </div>
      <p style={{ fontSize: 13 }}>यांस कडून सन {settingsYear?.year_label || p.year_label} या आर्थिक वर्षाबद्दल पुढील रक्कम मिळाली.</p>

      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>कराचे नांव</th>
              <th className="num">मागील बाकी</th>
              <th className="num">चालू कर</th>
              <th className="num">एकूण कर रुपये</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.previous.toFixed(2)}</td>
                <td className="num">{r.current.toFixed(2)}</td>
                <td className="num">{(r.previous + r.current).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>एकूण</td>
              <td className="num">{totalPrevious.toFixed(2)}</td>
              <td className="num">{totalCurrent.toFixed(2)}</td>
              <td className="num">{grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 13, marginTop: 10 }}><strong>अक्षरी रु.:</strong> {amountToMarathiWords(grandTotal)}</p>

      <p style={{ fontSize: 13 }}>
        <strong>जमा प्रकार:</strong>{' '}
        {PAYMENT_MODES.map((m) => `${p.payment_mode === m.key ? '☑' : '☐'} ${m.label}`).join('   ')}
      </p>
      {p.payment_mode === 'cheque' && (
        <p style={{ fontSize: 13 }}>
          <strong>बँकेचे नांव:</strong> {p.bank_name || '-'} &nbsp;&nbsp; <strong>चेक क्र.:</strong> {p.cheque_no || '-'}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 13 }}>
        <div>तारीख: {p.payment_date}</div>
        <div>वसुली करणाराची सही</div>
      </div>

      {canPrint && (
        <div className="no-print" style={{ marginTop: 14 }}>
          <button className="btn secondary" onClick={() => window.print()}>पावती प्रिंट करा</button>
        </div>
      )}
    </div>
  );
}
