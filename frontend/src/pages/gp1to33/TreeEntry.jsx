import { Fragment, useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import HeadCombo from '../../components/HeadCombo';

const fmt = (n) => Number(n || 0).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { location_detail: '', tree_type: '', info: '', tree_count: '1', expected_annual_income: '', disposal_date: '', disposal_details: '' };
const emptyIncome = { income_date: today(), amount: '', remark: '' };

// नमुना ३३ - वृक्ष नोंदवही. वृक्ष नोंदवा; मिळालेले उत्पन्न त्या वृक्ष नोंदीवर नोंदवा -
// ते आपोआप रोकड वहीत (नमुना ५) जमा होते व "प्रत्यक्ष उत्पन्न" त्यांची बेरीज असते.
export default function TreeEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [heads, setHeads] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [incomeId, setIncomeId] = useState(null);
  const [inc, setInc] = useState(emptyIncome);
  const [incHead, setIncHead] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);
  function load() { client.get('/trees').then(({ data }) => setRows(data)); }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editingId) await client.put(`/trees/${editingId}`, form); else await client.post('/trees', form);
      setForm(emptyForm); setEditingId(null); load();
    } catch (err) { setError(err.response?.data?.error || 'जतन करताना त्रुटी आली'); } finally { setBusy(false); }
  }
  function startEdit(t) {
    setEditingId(t.id);
    setForm({ location_detail: t.location_detail, tree_type: t.tree_type, info: t.info || '', tree_count: String(t.tree_count), expected_annual_income: String(t.expected_annual_income), disposal_date: t.disposal_date || '', disposal_details: t.disposal_details || '' });
  }
  async function remove(id) {
    if (!window.confirm('ही नोंद मिटवायची आहे का?')) return;
    try { await client.delete(`/trees/${id}`); load(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आले नाही'); }
  }
  async function addIncome(e, id) {
    e.preventDefault();
    setError('');
    if (!incHead) { setError('कृपया जमा लेखाशीर्ष निवडा'); return; }
    setBusy(true);
    try {
      await client.post(`/trees/${id}/income`, { ...inc, financial_year_id: yearId, ledger_head_id: incHead });
      setInc(emptyIncome); setIncHead(''); setIncomeId(null); load();
    } catch (err) { setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली'); } finally { setBusy(false); }
  }

  const canForm = editingId ? can('trees', 'edit') : can('trees', 'add');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>वृक्ष नोंदणी (नमुना ३३) {currentYear ? `— चालू वर्ष ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}
      {canForm && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>जमिनीचा/रस्त्याचा तपशील (आधारासामग्रीसह)</label><input value={form.location_detail} onChange={(e) => setForm({ ...form, location_detail: e.target.value })} required /></div>
              <div className="field"><label>वृक्षाचा प्रकार</label><input value={form.tree_type} onChange={(e) => setForm({ ...form, tree_type: e.target.value })} required /></div>
              <div className="field"><label>वृक्षांची संख्या</label><input type="number" min="0" value={form.tree_count} onChange={(e) => setForm({ ...form, tree_count: e.target.value })} /></div>
              <div className="field"><label>अपेक्षित वार्षिक उत्पन्न</label><input type="number" step="0.01" min="0" value={form.expected_annual_income} onChange={(e) => setForm({ ...form, expected_annual_income: e.target.value })} /></div>
              <div className="field"><label>वृक्षाविषयीची अधिक माहिती</label><input value={form.info} onChange={(e) => setForm({ ...form, info: e.target.value })} /></div>
              {editingId && (
                <>
                  <div className="field"><label>तोडल्याचा/नष्ट झाल्याचा दिनांक</label><input type="date" value={form.disposal_date} onChange={(e) => setForm({ ...form, disposal_date: e.target.value })} /></div>
                  <div className="field"><label>तोडल्याबाबतचा तपशील</label><input value={form.disposal_details} onChange={(e) => setForm({ ...form, disposal_details: e.target.value })} /></div>
                </>
              )}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      <div className="card no-print">
        <div className="table-wrap">
          <table>
            <thead><tr><th>तपशील</th><th>प्रकार</th><th className="num">संख्या</th><th className="num">अपेक्षित उत्पन्न</th><th className="num">प्रत्यक्ष उत्पन्न</th><th>तोडल्याबाबत</th><th></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <Fragment key={t.id}>
                  <tr>
                    <td>{t.location_detail}</td><td>{t.tree_type}</td><td className="num">{t.tree_count}</td>
                    <td className="num">{fmt(t.expected_annual_income)}</td><td className="num"><strong>{fmt(t.actual_income_total)}</strong></td>
                    <td>{t.disposal_date ? `${t.disposal_date} ${t.disposal_details || ''}` : '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {can('trees', 'edit') && <button className="btn secondary small" type="button" onClick={() => { setIncomeId(incomeId === t.id ? null : t.id); setInc(emptyIncome); }}>उत्पन्न</button>}
                      {can('trees', 'edit') && <button className="btn secondary small" type="button" onClick={() => startEdit(t)}>संपादन</button>}
                      {can('trees', 'delete') && <button className="btn danger small" type="button" onClick={() => remove(t.id)}>मिटवा</button>}
                    </td>
                  </tr>
                  {incomeId === t.id && (
                    <tr><td colSpan={7}>
                      <form onSubmit={(e) => addIncome(e, t.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <input type="date" value={inc.income_date} onChange={(e) => setInc({ ...inc, income_date: e.target.value })} required />
                        <input type="number" step="0.01" min="0" placeholder="रक्कम" value={inc.amount} onChange={(e) => setInc({ ...inc, amount: e.target.value })} required />
                        <div style={{ minWidth: 300 }}><HeadCombo heads={heads} groupType="जमा" value={incHead} onChange={setIncHead} /></div>
                        <input placeholder="शेरा" value={inc.remark} onChange={(e) => setInc({ ...inc, remark: e.target.value })} />
                        <button className="btn small" type="submit" disabled={busy}>नोंदवा (रोकड वहीत जमा)</button>
                      </form>
                      {t.income.length > 0 && <div style={{ marginTop: 8, fontSize: 13 }}>{t.income.map((i) => <div key={i.id}>{i.income_date} — {fmt(i.amount)} ({i.head_code})</div>)}</div>}
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
