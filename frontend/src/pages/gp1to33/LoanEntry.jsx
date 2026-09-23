import { Fragment, useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// नमुना २९ - कर्जाची नोंदणी. नोंद करताच रोकड वहीत (नमुना ५) जमा नोंदते
// (कर्ज मिळाले); प्रत्येक हप्ता भरताना "हप्ता भरा" कृतीने खर्च नोंदते -
// रक्कम दुसऱ्यांदा टाईप करायची नाही.
export default function LoanEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const [heads, setHeads] = useState([]);
  const [source, setSource] = useState('');
  const [sanctionOrderNo, setSanctionOrderNo] = useState('');
  const [sanctionDate, setSanctionDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [headSearch, setHeadSearch] = useState('');
  const [headDropdownOpen, setHeadDropdownOpen] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [repayingId, setRepayingId] = useState(null);
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repayPrincipal, setRepayPrincipal] = useState('');
  const [repayInterest, setRepayInterest] = useState('');

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/loans', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === 'जमा'), [heads]);
  const headSearchTerm = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => {
    if (!headSearchTerm) return leafHeads;
    return leafHeads.filter((h) => h.name.toLowerCase().includes(headSearchTerm) || h.code.toLowerCase().includes(headSearchTerm));
  }, [leafHeads, headSearchTerm]);

  function selectHead(h) { setSelectedHeadId(h.id); setHeadSearch(`${h.code} - ${h.name}`); setHeadDropdownOpen(false); }
  function resetForm() {
    setSource(''); setSanctionOrderNo(''); setSanctionDate(''); setPurpose(''); setLoanAmount(''); setInterestRate('');
    setRemark(''); setSelectedHeadId(''); setHeadSearch('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!source.trim()) { setError('कर्जाची उभारणीचे साधन आवश्यक आहे'); return; }
    if (!selectedHeadId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    const amt = Number(loanAmount || 0);
    if (amt <= 0) { setError('कर्जाची रक्कम शून्यापेक्षा जास्त हवी'); return; }
    setBusy(true);
    try {
      await client.post('/loans', {
        financial_year_id: yearId, source, sanction_order_no: sanctionOrderNo, sanction_date: sanctionDate || null,
        purpose, loan_amount: amt, interest_rate: interestRate || null, received_date: receivedDate,
        ledger_head_id: selectedHeadId, remark,
      });
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  function startRepay(row) {
    setRepayingId(row.id);
    setRepayDate(new Date().toISOString().slice(0, 10));
    setRepayPrincipal('');
    setRepayInterest('');
  }

  async function submitRepay(id) {
    setError('');
    try {
      await client.post(`/loans/${id}/repay`, {
        repayment_date: repayDate, principal_amount: Number(repayPrincipal) || 0, interest_amount: Number(repayInterest) || 0,
      });
      setRepayingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'हप्ता भरताना त्रुटी आली');
    }
  }

  const canAdd = can('loans', 'add');
  const canEdit = can('loans', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर्ज नोंदणी (नमुना २९) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>

      {canAdd && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>कर्जाची उभारणीचे साधन</label><input value={source} onChange={(e) => setSource(e.target.value)} required /></div>
              <div className="field"><label>मंजुरी आदेश क्रमांक</label><input value={sanctionOrderNo} onChange={(e) => setSanctionOrderNo(e.target.value)} /></div>
              <div className="field"><label>मंजुरी दिनांक</label><input type="date" value={sanctionDate} onChange={(e) => setSanctionDate(e.target.value)} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>कर्जाचे प्रयोजन</label><input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
              <div className="field"><label>कर्जाची रक्कम</label><input type="number" step="0.01" min="0" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} required /></div>
              <div className="field"><label>व्याज दर (%)</label><input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></div>
              <div className="field"><label>कर्ज मिळाल्याची तारीख</label><input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>लेखाशीर्ष (जमा)</label>
                <div className="combo-wrap">
                  <input
                    value={headSearch}
                    onChange={(e) => { setHeadSearch(e.target.value); setSelectedHeadId(''); setHeadDropdownOpen(true); }}
                    onFocus={() => setHeadDropdownOpen(true)}
                    placeholder="कोड किंवा नाव टाइप करा"
                    style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                  {headSearch && (
                    <button type="button" className="combo-clear-btn" onMouseDown={(e) => { e.preventDefault(); setHeadSearch(''); setSelectedHeadId(''); setHeadDropdownOpen(true); }}>×</button>
                  )}
                  {headDropdownOpen && (
                    <div className="combo-dropdown">
                      {headResults.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
                      {headResults.map((h) => <div key={h.id} className="combo-option" onMouseDown={() => selectHead(h)}>{h.code} - {h.name}</div>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : 'नोंद करा (रोकड वहीत पोस्ट होईल)'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>यादी</h2>
        {loading ? <p>लोड होत आहे...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>साधन</th><th>प्रयोजन</th><th>लेखाशीर्ष</th><th className="num">कर्ज रक्कम</th><th className="num">परतफेड (मुद्दल)</th><th className="num">शिल्लक</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>{r.source}</td>
                      <td>{r.purpose || '-'}</td>
                      <td>{r.head_code} - {r.head_name}</td>
                      <td className="num">{Number(r.loan_amount).toFixed(2)}</td>
                      <td className="num">{Number(r.principal_paid).toFixed(2)}</td>
                      <td className="num">{Number(r.balance).toFixed(2)}</td>
                      <td>{r.balance > 0.009 && canEdit && <button className="btn secondary small" onClick={() => startRepay(r)}>हप्ता भरा</button>}</td>
                    </tr>
                    {repayingId === r.id && (
                      <tr>
                        <td colSpan={7}>
                          <div className="card" style={{ margin: '8px 0' }}>
                            <div className="form-grid">
                              <div className="field"><label>हप्ता दिनांक</label><input type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} /></div>
                              <div className="field"><label>मुद्दल रक्कम</label><input type="number" step="0.01" value={repayPrincipal} onChange={(e) => setRepayPrincipal(e.target.value)} /></div>
                              <div className="field"><label>व्याज रक्कम</label><input type="number" step="0.01" value={repayInterest} onChange={(e) => setRepayInterest(e.target.value)} /></div>
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                              <button className="btn" type="button" onClick={() => submitRepay(r.id)}>जतन करा</button>
                              <button className="btn secondary" type="button" onClick={() => setRepayingId(null)}>रद्द करा</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
