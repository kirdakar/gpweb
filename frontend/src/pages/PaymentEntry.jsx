import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import CloseReportButton from '../components/CloseReportButton';
import { fmtDate } from '../utils/formatDate';
import { GROUP_COMPONENTS, RECEIPT_LABELS, EXTRA_FIELDS, PAYMENT_MODES, ReceiptPrintout } from '../components/TaxReceiptPrintout';

// घरपट्टी पावती (नमुना नं. १०) = घरपट्टी + दिवाबत्ती(वीज कर) + आरोग्य कर,
// पाणीपट्टी पावती (नमुना नं. १०, वेगळे पुस्तक) = फक्त पाणी पट्टी - दोन्ही
// आता स्वतंत्र पावती-मालिका (receipt_type), स्वतंत्र वाढत जाणारा receipt_no,
// आणि स्वतंत्र FIFO वाटप (पहा backend utils/dueAllocation.js). शिवाय आता
// कर जमा भरणे मालमत्ता-निहाय नव्हे तर कोड-निहाय - एका कोडखालील (मालकाच्या)
// सर्व मालमत्तांची बाकी एकत्रित करून, त्यातून मालमत्ता क्रं.च्या क्रमाने
// (आधी पहिली मालमत्ता पूर्ण, मग पुढची) वसूल होते. छापील पावतीचे स्वरूप
// (GROUP_COMPONENTS/RECEIPT_LABELS/EXTRA_FIELDS/PAYMENT_MODES/ReceiptPrintout)
// आता components/TaxReceiptPrintout.jsx मध्ये - PaymentReceiptView.jsx
// (इतिहासातील जुनी पावती नवीन टॅबमध्ये) तेच वापरते, दुहेरी व्याख्या टाळली.
const emptyExtras = { khuli_jaga: '', notice_fee: '', warrant_fee: '', other: '' };

export default function PaymentEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  // कोड/मालमत्ता क्रं./नाव टाइप करून शोधणारा combo - सुरुवातीस (काहीही टाइप
  // न करताच) संपूर्ण यादी दिसावी. यादी कोड नंबरवर ग्रुप करून दाखवतो - एका
  // कोडखाली अनेक मालमत्ता (portions) असल्या तरी ते नाव एकदाच दिसावे म्हणून
  // (डबल-डबल नांवे नकोत, कारण आता जमा भरणे मालमत्ता-निहाय नसून कोड-निहाय आहे).
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);

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
  const [displayedReceipt, setDisplayedReceipt] = useState(null); // नुकतीच जमा करून तयार केलेली पावती (याच पानावर लगेच दाखवते); इतिहासातील जुनी पावती आता नवीन टॅबमध्ये (PaymentReceiptView.jsx) उघडते
  const [detailModal, setDetailModal] = useState(null); // मागील बाकी/चालू बाकी/जमा चा वर्षवार-मालमत्तावार-हेडवार तपशील

  useEffect(() => {
    client.get('/properties', { params: { page: 1, pageSize: 5000, yearId } }).then(({ data }) => setRows(data.data));
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

  async function loadSummary(code, type, { resetReceipt = true } = {}) {
    if (resetReceipt) setDisplayedReceipt(null);
    setError('');
    setLoadingSummary(true);
    try {
      const { data } = await client.get('/payments/due-summary', { params: { propertyCode: code, yearId, receiptType: type } });
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

  function selectCode(opt) {
    setSelectedCode(opt.property_code);
    setSearch(`${opt.property_code} - ${opt.owner_name}`);
    setDropdownOpen(false);
    setReceiptType('gharpatti');
    loadSummary(opt.property_code, 'gharpatti');
  }

  function clearSearch() {
    setSearch('');
    setSelectedCode(null);
    setSummary(null);
    setDisplayedReceipt(null);
    setDropdownOpen(false);
  }

  function switchReceiptType(type) {
    setReceiptType(type);
    if (selectedCode != null) loadSummary(selectedCode, type);
  }

  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return codeOptions;
    return codeOptions.filter((o) =>
      (o.owner_name || '').toLowerCase().includes(searchTerm)
      || o.malmata_nos.some((m) => String(m || '').toLowerCase().includes(searchTerm))
      || String(o.property_code).includes(searchTerm)
    );
  }, [codeOptions, searchTerm]);

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
        property_code: summary.property.property_code,
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
      await loadSummary(summary.property.property_code, receiptType, { resetReceipt: false });
      setDisplayedReceipt(data);
    } catch (err) {
      setError(err.response?.data?.error || 'जमा करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid(paymentId) {
    if (!window.confirm('ही पावती रद्द (मिटवायची) करायची आहे का? ही क्रिया परत करता येणार नाही.')) return;
    await client.delete(`/payments/${paymentId}`);
    loadSummary(summary.property.property_code, receiptType);
  }

  // मागील बाकी (देय)/चालू वर्ष (देय)/आजवर जमा (वसूल) या एकत्रित आकड्यांचे
  // वर्षवार, मालमत्ता क्रं.-वार, हेड-वार तपशील (पहा backend /due-detail).
  const DETAIL_TITLES = { previous: 'मागील बाकी (देय) - तपशील', current: 'चालू वर्ष (देय) - तपशील', paid: 'आजवर जमा (वसूल) - तपशील' };
  async function openDetail(kind) {
    setError('');
    try {
      const { data } = await client.get('/payments/due-detail', {
        params: { propertyCode: summary.property.property_code, yearId, receiptType },
      });
      const rows = data.detail
        .filter((r) => (kind === 'previous' ? !r.is_current : kind === 'current' ? r.is_current : Number(r.paid) > 0))
        .map((r) => ({ ...r, amount: kind === 'paid' ? Number(r.paid) : Number(r.due) }))
        .filter((r) => r.amount > 0)
        .sort((a, b) => (a.year_label !== b.year_label ? a.year_label.localeCompare(b.year_label)
          : a.malmata_no !== b.malmata_no ? String(a.malmata_no).localeCompare(String(b.malmata_no)) : 0));
      setDetailModal({ kind, title: DETAIL_TITLES[kind], rows });
    } catch (err) {
      setError(err.response?.data?.error || 'तपशील आणताना त्रुटी आली');
    }
  }

  const components = GROUP_COMPONENTS[receiptType];
  const extraFields = EXTRA_FIELDS[receiptType];

  return (
    <div className="page data-entry-page">
      <div className="page-header no-print">
        <h1>कर जमा भरणे {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ alignItems: 'flex-start' }}>
          <div className="combo-wrap">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCode(null); setSummary(null); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="मालकाचे नाव, मालमत्ता क्र. किंवा कोड टाइप करा - क्लिक केल्यावर संपूर्ण यादी दिसेल"
              style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
              autoFocus
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
          <button className="btn secondary" type="button" onClick={clearSearch} disabled={!search && selectedCode == null}>शोध क्लिअर करा</button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loadingSummary && <p>लोड होत आहे...</p>}

      {summary && (
        <>
          <div className="card no-print" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, marginTop: 0 }}>
              {summary.property.owner_name} — कोड {summary.property.property_code} — मालमत्ता क्र.: {summary.property.malmata_no_list}
              {summary.property.portion_count > 1 && ` (${summary.property.portion_count} मालमत्ता एकत्रित)`}
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

            <DueSummary summary={summary} components={components} openDetail={openDetail} />
            {summary.unallocated_advance > 0 && (
              <div className="notice-box">
                {RECEIPT_LABELS[receiptType]}पोटी सर्व देय रक्कम भरून झाली असून ₹{summary.unallocated_advance.toFixed(2)} जास्त (आगाऊ) जमा आहे.
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              वसुली क्रम: प्रथम मागील बाकी, नंतर चालू वर्ष ({components.map((c) => c.label).join(' → ')} याच क्रमाने).
              {summary.property.portion_count > 1 && ' कोडखालील सर्व मालमत्तांची बाकी एकत्रित करून, मालमत्ता क्रं.च्या क्रमाने (आधी पहिली पूर्ण, मग पुढची) वसूल होते.'}
              {' '}घरपट्टी व पाणीपट्टी यांचे वाटप एकमेकांपासून पूर्णपणे स्वतंत्र आहे.
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

          {displayedReceipt && (
            <ReceiptPrintout receipt={displayedReceipt} property={summary.property} receiptType={receiptType} canPrint={can('payments', 'print')} />
          )}

          <div className="card no-print">
            <h2 style={{ fontSize: 15, marginTop: 0 }}>{RECEIPT_LABELS[receiptType]} इतिहास</h2>
            <ReceiptHistory history={summary.history} can={can} handleVoid={handleVoid} />
          </div>

          {detailModal && (
            <DueDetailModal modal={detailModal} components={components} onClose={() => setDetailModal(null)} />
          )}
        </>
      )}
    </div>
  );
}

// मागील बाकी (देय)/चालू वर्ष (देय)/आजवर जमा (वसूल) चा वर्षवार-मालमत्तावार-
// हेडवार तपशील (कोडखाली अनेक मालमत्ता/मागील अनेक वर्षे एकत्रित असल्याने
// नेमकी कोणत्या वर्षाची/मालमत्तेची/हेडची रक्कम आहे हे इथे उघड होते).
function DueDetailModal({ modal, components, onClose }) {
  const total = modal.rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="modal-overlay no-print" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{modal.title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>वर्ष</th><th>मालमत्ता क्र.</th><th>हेड</th><th className="num">रक्कम</th></tr>
            </thead>
            <tbody>
              {modal.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.year_label}</td>
                  <td>{r.malmata_no}</td>
                  <td>{components.find((c) => c.key === r.component)?.label || r.component}</td>
                  <td className="num">{r.amount.toFixed(2)}</td>
                </tr>
              ))}
              {modal.rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center' }}>तपशील उपलब्ध नाही</td></tr>}
              <tr className="total-row"><td colSpan={3}>एकूण</td><td className="num">{total.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button className="btn secondary" type="button" onClick={onClose}>बंद करा</button>
        </div>
      </div>
    </div>
  );
}


// देय/जमा/उर्वरित सारांश - संगणकावर तक्ता (हेड स्तंभ), फोनवर प्रत्येक हेडचे स्वतंत्र कार्ड (CSS ने एकच दिसते).
// दोन्ही एकाच dueRows यादीतून तयार होतात, त्यामुळे आकडे नेहमी जुळतात.
function buildDueRows(summary, components) {
  const num = (v) => Number(v || 0);
  const prop = summary.property;
  const rows = [
    { key: 'previous', label: 'मागील बाकी (देय)', detail: 'previous', vals: components.map((c) => num(prop[`previous_${c.key}`])) },
    { key: 'current', label: 'चालू वर्ष (देय)', detail: 'current', vals: components.map((c) => num(prop[`current_${c.key}`])) },
  ];
  for (const kind of ['discount', 'penalty']) {
    const vals = components.map((c) => num(prop[`${kind}_previous_${c.key}`]) + num(prop[`${kind}_current_${c.key}`]));
    if (vals.reduce((a, b) => a + b, 0) <= 0) continue;
    rows.push({ key: kind, label: kind === 'discount' ? 'यात सूट (वजा केलेली)' : 'यात दंड (समाविष्ट)', tone: kind, italic: true, vals });
  }
  rows.push({
    key: 'paid', label: 'आजवर जमा (वसूल)', detail: 'paid', tone: 'success', total: num(summary.total_paid),
    vals: components.map((c) => num(summary.paid_by_component[`previous_${c.key}`]) + num(summary.paid_by_component[`current_${c.key}`])),
  });
  rows.push({
    key: 'balance', label: 'उर्वरित बाकी', isTotal: true, total: num(summary.balance_due),
    vals: components.map((c) => num(summary.balance_by_component[`previous_${c.key}`]) + num(summary.balance_by_component[`current_${c.key}`])),
  });
  for (const r of rows) if (r.total === undefined) r.total = r.vals.reduce((a, b) => a + b, 0);
  return rows;
}

const toneColor = (tone) => (tone === 'discount' || tone === 'success' ? 'var(--success)' : tone === 'penalty' ? 'var(--danger)' : undefined);

function DueSummary({ summary, components, openDetail }) {
  const rows = buildDueRows(summary, components);
  const detailBtn = (r) => r.detail && (
    <>{' '}<button type="button" className="detail-btn" onClick={() => openDetail(r.detail)}>तपशील</button></>
  );
  const cards = [...components.map((c, i) => ({ title: c.label, idx: i })), { title: 'एकूण', idx: -1 }];
  return (
    <>
      <div className="table-wrap due-table" style={{ marginBottom: 14 }}>
        <table>
          <thead>
            <tr>
              <th></th>
              {components.map((c) => <th key={c.key} className="num">{c.label}</th>)}
              <th className="num">एकूण</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.isTotal ? 'total-row' : undefined}
                style={{ color: toneColor(r.tone), fontStyle: r.italic ? 'italic' : undefined }}>
                <td>{r.label}{detailBtn(r)}</td>
                {r.vals.map((v, i) => <td key={components[i].key} className="num">{v.toFixed(2)}</td>)}
                <td className="num">{r.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="due-cards">
        {cards.map((card) => (
          <div key={card.title} className={`due-card${card.idx === -1 ? ' due-card-total' : ''}`}>
            <div className="due-card-title">{card.title}</div>
            {rows.map((r) => (
              <div key={r.key} className={`due-card-row${r.isTotal ? ' due-card-balance' : ''}`}
                style={{ color: toneColor(r.tone), fontStyle: r.italic ? 'italic' : undefined }}>
                <span>{r.label}{card.idx === -1 && detailBtn(r)}</span>
                <strong>{(card.idx === -1 ? r.total : r.vals[card.idx]).toFixed(2)}</strong>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// पावती इतिहास - संगणकावर तक्ता, फोनवर प्रत्येक पावतीचे कार्ड.
function ReceiptHistory({ history, can, handleVoid }) {
  const amountOf = (h) => (Number(h.amount) + Number(h.khuli_jaga_amount || 0) + Number(h.notice_fee_amount || 0)
    + Number(h.warrant_fee_amount || 0) + Number(h.other_amount || 0)).toFixed(2);
  const actions = (h) => (
    <>
      <a className="btn secondary small" href={`/payments/receipt/${h.id}`} target="_blank" rel="noopener noreferrer">पावती पहा</a>{' '}
      {can('payments', 'delete') && <button className="btn danger small" onClick={() => handleVoid(h.id)}>रद्द करा</button>}
    </>
  );
  return (
    <>
      <div className="table-wrap history-table">
        <table>
          <thead><tr><th>पावती क्र.</th><th>दिनांक</th><th>वर्ष</th><th className="num">रक्कम</th><th>शेरा</th><th></th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.receipt_no}</td>
                <td>{fmtDate(h.payment_date)}</td>
                <td>{h.year_label}</td>
                <td className="num">{amountOf(h)}</td>
                <td>{h.narration || '-'}</td>
                <td>{actions(h)}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>अद्याप जमा नोंद नाही</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="history-cards">
        {history.map((h) => (
          <div key={h.id} className="due-card">
            <div className="due-card-title">पावती क्र. {h.receipt_no} <span style={{ fontWeight: 400 }}>— {fmtDate(h.payment_date)}</span></div>
            <div className="due-card-row"><span>रक्कम</span><strong>{amountOf(h)}</strong></div>
            <div className="due-card-row"><span>वर्ष</span><span>{h.year_label}</span></div>
            {h.narration && <div className="due-card-row"><span>शेरा</span><span>{h.narration}</span></div>}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions(h)}</div>
          </div>
        ))}
        {history.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>अद्याप जमा नोंद नाही</p>}
      </div>
    </>
  );
}
