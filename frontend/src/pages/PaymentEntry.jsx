import { useEffect, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import useDebouncedValue from '../hooks/useDebouncedValue';

const COMPONENTS = [
  { key: 'gharpatti', label: 'घरपट्टी' },
  { key: 'divabatti', label: 'दिवाबत्ती' },
  { key: 'arogya', label: 'आरोग्य कर' },
  { key: 'panipatti', label: 'पाणीपट्टी' },
];

export default function PaymentEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) { setMatches([]); return; }
    client.get('/properties', { params: { search: debouncedSearch, page: 1, pageSize: 20, yearId } })
      .then(({ data }) => setMatches(data.data));
  }, [debouncedSearch, yearId]);

  async function loadSummary(propertyId, { resetReceipt = true } = {}) {
    if (resetReceipt) setLastReceipt(null);
    setError('');
    setLoadingSummary(true);
    try {
      const { data } = await client.get('/payments/due-summary', { params: { propertyId, yearId } });
      setSummary(data);
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.error || 'माहिती आणताना त्रुटी आली');
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('कृपया योग्य रक्कम टाका');
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post('/payments', {
        property_id: summary.property.property_id,
        financial_year_id: yearId,
        payment_date: paymentDate,
        amount: amt,
        narration,
      });
      setNarration('');
      await loadSummary(summary.property.property_id, { resetReceipt: false });
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
    loadSummary(summary.property.property_id);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>कर जमा भरणे {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: matches.length ? 12 : 0 }}>
          <input placeholder="मालकाचे नाव, मालमत्ता क्र. किंवा कोड टाइप करा (शोध आपोआप होतो)" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        {matches.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>कोड</th><th>मालमत्ता क्र.</th><th>मालकाचे नाव</th><th></th></tr></thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id}>
                    <td>{m.property_code}</td><td>{m.malmata_no}</td><td>{m.owner_name}</td>
                    <td><button className="btn small" onClick={() => loadSummary(m.id)}>निवडा</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      {loadingSummary && <p>लोड होत आहे...</p>}

      {summary && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, marginTop: 0 }}>
              {summary.property.owner_name} — मालमत्ता क्र. {summary.property.malmata_no ?? '-'}
            </h2>

            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}</th>)}
                    <th className="num">एकूण</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>मागील बाकी (देय)</td>
                    {COMPONENTS.map((c) => <td key={c.key} className="num">{Number(summary.property[`previous_${c.key}`] || 0).toFixed(2)}</td>)}
                    <td className="num">{COMPONENTS.reduce((s, c) => s + Number(summary.property[`previous_${c.key}`] || 0), 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>चालू वर्ष (देय)</td>
                    {COMPONENTS.map((c) => <td key={c.key} className="num">{Number(summary.property[`current_${c.key}`] || 0).toFixed(2)}</td>)}
                    <td className="num">{COMPONENTS.reduce((s, c) => s + Number(summary.property[`current_${c.key}`] || 0), 0).toFixed(2)}</td>
                  </tr>
                  <tr style={{ color: 'var(--success)' }}>
                    <td>आजवर जमा (वसूल)</td>
                    {COMPONENTS.map((c) => (
                      <td key={c.key} className="num">
                        {(Number(summary.paid_by_component[`previous_${c.key}`] || 0) + Number(summary.paid_by_component[`current_${c.key}`] || 0)).toFixed(2)}
                      </td>
                    ))}
                    <td className="num">{summary.total_paid.toFixed(2)}</td>
                  </tr>
                  <tr className="total-row">
                    <td>उर्वरित बाकी</td>
                    {COMPONENTS.map((c) => (
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
                या मालमत्तेवर सर्व देय रक्कम भरून झाली असून ₹{summary.unallocated_advance.toFixed(2)} जास्त (आगाऊ) जमा आहे.
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              वसुली क्रम: प्रथम मागील बाकी (घरपट्टी → दिवाबत्ती → आरोग्य कर → पाणीपट्टी), नंतर चालू वर्ष याच क्रमाने.
            </p>
          </div>

          {can('payments', 'add') && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, marginTop: 0 }}>नवीन जमा नोंद</h2>
              <form onSubmit={handlePay}>
                <div className="form-grid">
                  <div className="field">
                    <label>दिनांक</label>
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>जमा रक्कम *</label>
                    <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
                  </div>
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

          {lastReceipt && <ReceiptCard receipt={lastReceipt} property={summary.property} canPrint={can('payments', 'print')} />}

          <div className="card">
            <h2 style={{ fontSize: 15, marginTop: 0 }}>पावती इतिहास</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>पावती क्र.</th><th>दिनांक</th><th>वर्ष</th><th className="num">रक्कम</th><th>शेरा</th><th></th></tr></thead>
                <tbody>
                  {summary.history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.id}</td>
                      <td>{h.payment_date}</td>
                      <td>{h.year_label}</td>
                      <td className="num">{Number(h.amount).toFixed(2)}</td>
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

function ReceiptCard({ receipt, property, canPrint }) {
  return (
    <div className="card no-print" style={{ marginBottom: 20, borderColor: 'var(--success)' }}>
      <div className="print-header">
        <h2>ग्रामपंचायत — जमा पावती</h2>
        <p>पावती क्र. {receipt.payment.id} | दिनांक: {receipt.payment.payment_date} | वर्ष: {receipt.payment.year_label}</p>
      </div>
      <p><strong>मालकाचे नाव:</strong> {property.owner_name}</p>
      <p><strong>जमा रक्कम:</strong> ₹{Number(receipt.payment.amount).toFixed(2)}</p>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th></th>{COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}</th>)}</tr></thead>
          <tbody>
            <tr>
              <td>मागील बाकीतून वसूल</td>
              {COMPONENTS.map((c) => <td key={c.key} className="num">{Number(receipt.coveredByThisReceipt[`previous_${c.key}`] || 0).toFixed(2)}</td>)}
            </tr>
            <tr>
              <td>चालू वर्षातून वसूल</td>
              {COMPONENTS.map((c) => <td key={c.key} className="num">{Number(receipt.coveredByThisReceipt[`current_${c.key}`] || 0).toFixed(2)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {canPrint && (
        <div style={{ marginTop: 14 }}>
          <button className="btn secondary" onClick={() => window.print()}>पावती प्रिंट करा</button>
        </div>
      )}
    </div>
  );
}
