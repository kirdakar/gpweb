import { Fragment, useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

// नमुना २५ - गुंतवणूक नोंदणी (मुदत ठेव/राष्ट्रीय बचत/सरकारी रोखे). नोंद
// करताच रोकड वहीत (नमुना ५) खर्च नोंदते; परिपक्व/भरणा झाल्यावर "परिपक्व
// करा" कृतीने मिळालेली रक्कम जमा नोंदते - रक्कम दुसऱ्यांदा टाईप करायची नाही.
export default function InvestmentEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const [heads, setHeads] = useState([]);
  const [description, setDescription] = useState('');
  const [investmentDate, setInvestmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [headSearch, setHeadSearch] = useState('');
  const [headDropdownOpen, setHeadDropdownOpen] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [maturedAmount, setMaturedAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [maturingId, setMaturingId] = useState(null);
  const [maturedDateInput, setMaturedDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivedAmount, setReceivedAmount] = useState('');

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/investments', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === 'खर्च'), [heads]);
  const headSearchTerm = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => {
    if (!headSearchTerm) return leafHeads;
    return leafHeads.filter((h) => h.name.toLowerCase().includes(headSearchTerm) || h.code.toLowerCase().includes(headSearchTerm));
  }, [leafHeads, headSearchTerm]);

  function selectHead(h) { setSelectedHeadId(h.id); setHeadSearch(`${h.code} - ${h.name}`); setHeadDropdownOpen(false); }
  function resetForm() {
    setDescription(''); setPurchasePrice(''); setMaturityDate(''); setMaturedAmount(''); setRemark('');
    setSelectedHeadId(''); setHeadSearch('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!description.trim()) { setError('गुंतवणुकीचा तपशील आवश्यक आहे'); return; }
    if (!selectedHeadId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    const price = Number(purchasePrice || 0);
    if (price <= 0) { setError('रक्कम शून्यापेक्षा जास्त हवी'); return; }
    setBusy(true);
    try {
      await client.post('/investments', {
        financial_year_id: yearId, investment_date: investmentDate, description,
        purchase_price: price, maturity_date: maturityDate || null, matured_amount: maturedAmount || null,
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

  function startMature(row) {
    setMaturingId(row.id);
    setMaturedDateInput(new Date().toISOString().slice(0, 10));
    setReceivedAmount(String(row.matured_amount || row.purchase_price));
  }

  async function submitMature(id) {
    setError('');
    try {
      await client.post(`/investments/${id}/mature`, { matured_date: maturedDateInput, received_amount: Number(receivedAmount) || 0 });
      setMaturingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'परिपक्व करताना त्रुटी आली');
    }
  }

  const canAdd = can('investments', 'add');
  const canEdit = can('investments', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>गुंतवणूक नोंदणी (नमुना २५) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>

      {canAdd && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>गुंतवणुकीचा तपशील (बँक/संस्था, प्रमाणपत्र क्र.)</label><input value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
              <div className="field"><label>गुंतवणूक दिनांक</label><input type="date" value={investmentDate} onChange={(e) => setInvestmentDate(e.target.value)} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>लेखाशीर्ष (खर्च)</label>
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
              <div className="field"><label>खरेदी किंमत</label><input type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required /></div>
              <div className="field"><label>मुदत दिनांक (अपेक्षित)</label><input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} /></div>
              <div className="field"><label>अपेक्षित परिणत रक्कम</label><input type="number" step="0.01" value={maturedAmount} onChange={(e) => setMaturedAmount(e.target.value)} /></div>
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
                <tr><th>तपशील</th><th>गुंतवणूक दिनांक</th><th>लेखाशीर्ष</th><th className="num">रक्कम</th><th>मुदत दिनांक</th><th>स्थिती</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>{r.description}</td>
                      <td>{fmtDate(r.investment_date)}</td>
                      <td>{r.head_code} - {r.head_name}</td>
                      <td className="num">{Number(r.purchase_price).toFixed(2)}</td>
                      <td>{fmtDate(r.maturity_date) || '-'}</td>
                      <td>{r.is_matured ? `परिपक्व (${Number(r.matured_amount).toFixed(2)})` : 'सुरू'}</td>
                      <td>{!r.is_matured && canEdit && <button className="btn secondary small" onClick={() => startMature(r)}>परिपक्व करा</button>}</td>
                    </tr>
                    {maturingId === r.id && (
                      <tr>
                        <td colSpan={7}>
                          <div className="card" style={{ margin: '8px 0' }}>
                            <div className="form-grid">
                              <div className="field"><label>परिपक्वता/भरणा दिनांक</label><input type="date" value={maturedDateInput} onChange={(e) => setMaturedDateInput(e.target.value)} /></div>
                              <div className="field"><label>मिळालेली रक्कम</label><input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} /></div>
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                              <button className="btn" type="button" onClick={() => submitMature(r.id)}>जतन करा</button>
                              <button className="btn secondary" type="button" onClick={() => setMaturingId(null)}>रद्द करा</button>
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
