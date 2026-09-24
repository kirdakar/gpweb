import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

const PAYMENT_MODES = ['रोख', 'धनादेश'];
const REGISTERS = ['मुख्य', 'किरकोळ'];

// नमुना ५ (मुख्य रोकड वही) आणि नमुना १८ (किरकोळ रोकडवही) - दोन्ही एकाच
// cash_book_entries टेबलमध्ये, register स्तंभाने वेगळे (डुप्लिकेट टेबल/UI
// टाळण्यासाठी). प्रत्येक जमा/खर्च व्यवहार लेखाशीर्षाशी जोडून नोंदतो; नमुना ६
// (वर्गीकृत नोंदवही) या नोंदींवरूनच काढलेला रिपोर्ट आहे (फक्त register='मुख्य').
export default function CashBookEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const [heads, setHeads] = useState([]);
  const [entryType, setEntryType] = useState('जमा');
  const [register, setRegister] = useState('मुख्य');
  const [headSearch, setHeadSearch] = useState('');
  const [headDropdownOpen, setHeadDropdownOpen] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState('');

  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('रोख');
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [narration, setNarration] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [recentEntries, setRecentEntries] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    client.get('/ledger-heads').then(({ data }) => setHeads(data));
  }, []);

  function loadRecent() {
    if (!yearId) return;
    setLoadingRecent(true);
    client.get('/cash-book', { params: { financialYearId: yearId, register } })
      .then(({ data }) => setRecentEntries(data.slice(-30).reverse()))
      .finally(() => setLoadingRecent(false));
  }
  useEffect(() => { loadRecent(); }, [yearId, register]);

  // फक्त leaf (प्रत्यक्ष नोंद करता येणारे) शीर्ष, निवडलेल्या जमा/खर्च
  // प्रकाराशी जुळणारे - इतर मास्टर स्क्रीनवरील शोधा-कंबोसारखेच.
  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === entryType), [heads, entryType]);
  const headSearchTerm = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => {
    if (!headSearchTerm) return leafHeads;
    return leafHeads.filter((h) => h.name.toLowerCase().includes(headSearchTerm) || h.code.toLowerCase().includes(headSearchTerm));
  }, [leafHeads, headSearchTerm]);

  function selectHead(h) {
    setSelectedHeadId(h.id);
    setHeadSearch(`${h.code} - ${h.name}`);
    setHeadDropdownOpen(false);
  }

  function switchType(type) {
    setEntryType(type);
    setSelectedHeadId('');
    setHeadSearch('');
  }

  function resetForm() {
    setAmount(''); setPaymentMode('रोख'); setReferenceNo(''); setReferenceDate(''); setNarration('');
    setSelectedHeadId(''); setHeadSearch('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!selectedHeadId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    const amt = Number(amount || 0);
    if (amt <= 0) { setError('रक्कम शून्यापेक्षा जास्त हवी'); return; }
    setBusy(true);
    try {
      await client.post('/cash-book', {
        financial_year_id: yearId,
        entry_date: entryDate,
        ledger_head_id: selectedHeadId,
        entry_type: entryType,
        register,
        amount: amt,
        payment_mode: paymentMode,
        reference_no: referenceNo,
        reference_date: referenceDate || null,
        narration,
      });
      resetForm();
      loadRecent();
    } catch (err) {
      setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('ही नोंद मिटवायची आहे का?')) return;
    await client.delete(`/cash-book/${id}`);
    loadRecent();
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>{register === 'मुख्य' ? 'दैनिक रोकड वही (नमुना ५)' : 'किरकोळ रोकडवही (नमुना १८)'} {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {REGISTERS.map((r) => (
            <button key={r} type="button" className={`btn ${register === r ? '' : 'secondary'}`} onClick={() => setRegister(r)}>{r}</button>
          ))}
        </div>
      </div>

      {can('cash_book', 'add') && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button type="button" className={`btn ${entryType === 'जमा' ? '' : 'secondary'}`} onClick={() => switchType('जमा')}>जमा</button>
            <button type="button" className={`btn ${entryType === 'खर्च' ? '' : 'secondary'}`} onClick={() => switchType('खर्च')}>खर्च</button>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>दिनांक</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>लेखाशीर्ष</label>
                <div className="combo-wrap">
                  <input
                    value={headSearch}
                    onChange={(e) => { setHeadSearch(e.target.value); setSelectedHeadId(''); setHeadDropdownOpen(true); }}
                    onFocus={() => setHeadDropdownOpen(true)}
                    placeholder="कोड किंवा नाव टाइप करा - क्लिक केल्यावर संपूर्ण यादी दिसेल"
                    style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                  {headSearch && (
                    <button type="button" className="combo-clear-btn" title="शोध पुसा"
                      onMouseDown={(e) => { e.preventDefault(); setHeadSearch(''); setSelectedHeadId(''); setHeadDropdownOpen(true); }}>×</button>
                  )}
                  {headDropdownOpen && (
                    <div className="combo-dropdown">
                      {headResults.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
                      {headResults.map((h) => (
                        <div key={h.id} className="combo-option" onMouseDown={() => selectHead(h)}>{h.code} - {h.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="field">
                <label>रक्कम</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="field">
                <label>जमा प्रकार</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>संदर्भ क्रमांक (पावती/देयक)</label>
                <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
              </div>
              <div className="field">
                <label>संदर्भ दिनांक</label>
                <input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>तपशील/नोंद</label>
                <input value={narration} onChange={(e) => setNarration(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : 'नोंद करा'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>अलीकडील नोंदी</h2>
        {loadingRecent ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>दिनांक</th><th>प्रकार</th><th>लेखाशीर्ष</th><th className="num">रक्कम</th><th>मोड</th><th>संदर्भ</th><th>नोंद</th><th></th></tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.entry_date)}</td>
                    <td style={{ color: e.entry_type === 'जमा' ? 'var(--success)' : 'var(--danger)' }}>{e.entry_type}</td>
                    <td>{e.head_code} - {e.head_name}</td>
                    <td className="num">{Number(e.amount).toFixed(2)}</td>
                    <td>{e.payment_mode}</td>
                    <td>{e.reference_no || '-'}</td>
                    <td>{e.narration || '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {can('reports_receipt_voucher', 'print') && (
                        e.entry_type === 'जमा'
                          ? <Link className="btn secondary small" to={`/gp1to33/reports/receipt/${e.id}`}>पावती</Link>
                          : (
                            <>
                              <Link className="btn secondary small" to={`/gp1to33/reports/voucher/${e.id}`}>प्रमाणक</Link>
                              <Link className="btn secondary small" to={`/gp1to33/reports/refund/${e.id}`}>परतावा आदेश</Link>
                            </>
                          )
                      )}
                      {can('cash_book', 'delete') && <button className="btn danger small" onClick={() => handleDelete(e.id)}>रद्द करा</button>}
                    </td>
                  </tr>
                ))}
                {recentEntries.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
