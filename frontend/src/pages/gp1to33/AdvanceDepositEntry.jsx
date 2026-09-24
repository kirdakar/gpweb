import { Fragment, useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

const KINDS = { 'अग्रिम': 'खर्च', 'अनामत': 'जमा' };

// नमुना १७ - अग्रिम दिलेल्या/अनामत ठेवलेल्या रकमांची नोंदणी. नोंद करताच
// रोकड वहीत (नमुना ५) एक नोंद तयार होते (अग्रिम=खर्च, अनामत=जमा);
// परतफेड/समायोजन झाल्यावर तीच रक्कम उलट दिशेच्या नोंदीसाठी वापरतात -
// रक्कम दुसऱ्यांदा टाईप करायची नाही. प्रिंट अहवाल रिपोर्ट मेन्यूत.
export default function AdvanceDepositEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const [heads, setHeads] = useState([]);
  const [kind, setKind] = useState('अग्रिम');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [headSearch, setHeadSearch] = useState('');
  const [headDropdownOpen, setHeadDropdownOpen] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState(null);
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settleAmount, setSettleAmount] = useState('');
  const [settlePostToCashbook, setSettlePostToCashbook] = useState(true);
  const [settleNote, setSettleNote] = useState('');

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/advance-deposits', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === KINDS[kind]), [heads, kind]);
  const headSearchTerm = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => {
    if (!headSearchTerm) return leafHeads;
    return leafHeads.filter((h) => h.name.toLowerCase().includes(headSearchTerm) || h.code.toLowerCase().includes(headSearchTerm));
  }, [leafHeads, headSearchTerm]);

  function switchKind(k) { setKind(k); setSelectedHeadId(''); setHeadSearch(''); }
  function selectHead(h) { setSelectedHeadId(h.id); setHeadSearch(`${h.code} - ${h.name}`); setHeadDropdownOpen(false); }

  function resetForm() {
    setPartyName(''); setDescription(''); setAmount(''); setRemark(''); setSelectedHeadId(''); setHeadSearch('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!partyName.trim()) { setError('पक्षकाराचे नाव आवश्यक आहे'); return; }
    if (!selectedHeadId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    const amt = Number(amount || 0);
    if (amt <= 0) { setError('रक्कम शून्यापेक्षा जास्त हवी'); return; }
    setBusy(true);
    try {
      await client.post('/advance-deposits', {
        kind, party_name: partyName, description, financial_year_id: yearId,
        entry_date: entryDate, ledger_head_id: selectedHeadId, amount: amt, remark,
      });
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  function startSettle(row) {
    setSettlingId(row.id);
    setSettleDate(new Date().toISOString().slice(0, 10));
    setSettleAmount(String(row.balance));
    setSettlePostToCashbook(true);
    setSettleNote('');
  }

  async function submitSettle(id) {
    setError('');
    try {
      await client.post(`/advance-deposits/${id}/settle`, {
        settlement_date: settleDate, amount: Number(settleAmount) || 0,
        post_to_cashbook: settlePostToCashbook, note: settleNote,
      });
      setSettlingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'परतफेड नोंदताना त्रुटी आली');
    }
  }

  const canAdd = can('advance_deposits', 'add');
  const canEdit = can('advance_deposits', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>अग्रिम/अनामत नोंदणी (नमुना १७) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>

      {canAdd && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button type="button" className={`btn ${kind === 'अग्रिम' ? '' : 'secondary'}`} onClick={() => switchKind('अग्रिम')}>अग्रिम (दिलेली रक्कम)</button>
            <button type="button" className={`btn ${kind === 'अनामत' ? '' : 'secondary'}`} onClick={() => switchKind('अनामत')}>अनामत (ठेवलेली/मिळालेली रक्कम)</button>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>पक्षकाराचे नाव</label><input value={partyName} onChange={(e) => setPartyName(e.target.value)} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>तपशील</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="field"><label>दिनांक</label><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>लेखाशीर्ष</label>
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
              <div className="field"><label>रक्कम</label><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
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
                <tr><th>प्रकार</th><th>पक्षकार</th><th>तपशील</th><th>दिनांक</th><th>लेखाशीर्ष</th><th className="num">रक्कम</th><th className="num">भरलेले</th><th className="num">शिल्लक</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ color: r.kind === 'अग्रिम' ? 'var(--danger)' : 'var(--success)' }}>{r.kind}</td>
                      <td>{r.party_name}</td>
                      <td>{r.description || '-'}</td>
                      <td>{fmtDate(r.entry_date)}</td>
                      <td>{r.head_code} - {r.head_name}</td>
                      <td className="num">{Number(r.amount).toFixed(2)}</td>
                      <td className="num">{Number(r.settled_amount).toFixed(2)}</td>
                      <td className="num">{Number(r.balance).toFixed(2)}</td>
                      <td>
                        {r.is_settled ? <span style={{ color: 'var(--success)', fontSize: 13 }}>पूर्ण भरले</span> : (
                          canEdit && <button className="btn secondary small" onClick={() => startSettle(r)}>परतफेड/समायोजन</button>
                        )}
                      </td>
                    </tr>
                    {settlingId === r.id && (
                      <tr>
                        <td colSpan={9}>
                          <div className="card" style={{ margin: '8px 0' }}>
                            <div className="form-grid">
                              <div className="field"><label>दिनांक</label><input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} /></div>
                              <div className="field"><label>रक्कम</label><input type="number" step="0.01" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} /></div>
                              <div className="field">
                                <label><input type="checkbox" checked={settlePostToCashbook} onChange={(e) => setSettlePostToCashbook(e.target.checked)} /> रोकड वहीत नोंदवा (नसल्यास फक्त समायोजन)</label>
                              </div>
                              <div className="field" style={{ gridColumn: 'span 2' }}><label>टीप</label><input value={settleNote} onChange={(e) => setSettleNote(e.target.value)} /></div>
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                              <button className="btn" type="button" onClick={() => submitSettle(r.id)}>जतन करा</button>
                              <button className="btn secondary" type="button" onClick={() => setSettlingId(null)}>रद्द करा</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
