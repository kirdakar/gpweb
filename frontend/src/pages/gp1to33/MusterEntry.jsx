import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const fmt = (n) => Number(n || 0).toFixed(2);
const blankWorker = () => ({ name: '', address: '', gender: '', post: 'मजूर', rate_per_day: '', fine: '', attendance: 'A'.repeat(31) });
const daysIn = (y, m) => new Date(y, m, 0).getDate();

// नमुना १९ - कामावरील हजेरीपट. दिवसाच्या चौकोनावर क्लिक करून हजर (P)/गैरहजर (A)
// ठरवा; दिवस व मजुरी आपोआप मोजली जाते. "रोकड वहीत नोंद करा" ने एकूण मजुरी
// नमुना ५ मध्ये खर्च म्हणून एकदाच जाते - पुन्हा टाईप करायची नाही.
export default function MusterEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const now = new Date();

  const [heads, setHeads] = useState([]);
  const [works, setWorks] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [editingId, setEditingId] = useState(null); // null = नवीन
  const [posted, setPosted] = useState(false);
  const [form, setForm] = useState({ work_id: '', year: now.getFullYear(), month: now.getMonth() + 1, title: '' });
  const [workers, setWorkers] = useState([blankWorker()]);
  const [headSearch, setHeadSearch] = useState('');
  const [headOpen, setHeadOpen] = useState(false);
  const [headId, setHeadId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { client.get('/ledger-heads').then(({ data }) => setHeads(data)); }, []);
  function loadLists() {
    if (!yearId) return;
    client.get('/works', { params: { financialYearId: yearId } }).then(({ data }) => setWorks(data));
    client.get('/muster-rolls', { params: { financialYearId: yearId } }).then(({ data }) => setRolls(data));
  }
  useEffect(() => { loadLists(); resetForm(); }, [yearId]);

  const leafHeads = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === 'खर्च'), [heads]);
  const term = headSearch.trim().toLowerCase();
  const headResults = useMemo(() => (term ? leafHeads.filter((h) => h.name.toLowerCase().includes(term) || h.code.toLowerCase().includes(term)) : leafHeads), [leafHeads, term]);

  function resetForm() {
    setEditingId(null); setPosted(false); setError('');
    setForm({ work_id: '', year: now.getFullYear(), month: now.getMonth() + 1, title: '' });
    setWorkers([blankWorker()]); setHeadId(''); setHeadSearch('');
  }

  async function openRoll(id) {
    const { data } = await client.get(`/muster-rolls/${id}`);
    setEditingId(data.id); setPosted(!!data.cash_book_entry_id); setError('');
    setForm({ work_id: data.work_id || '', year: data.year, month: data.month, title: data.title || '' });
    setHeadId(data.ledger_head_id); setHeadSearch(`${data.head_code} - ${data.head_name}`);
    setWorkers(data.workers.map((w) => ({ name: w.name, address: w.address || '', gender: w.gender || '', post: w.post || '', rate_per_day: String(w.rate_per_day), fine: Number(w.fine) ? String(w.fine) : '', attendance: w.attendance })));
  }

  function setWorker(i, patch) { setWorkers((ws) => ws.map((w, n) => (n === i ? { ...w, ...patch } : w))); }
  function toggleDay(i, d) {
    const a = workers[i].attendance.split('');
    a[d] = a[d] === 'P' ? 'A' : 'P';
    setWorker(i, { attendance: a.join('') });
  }
  function fillAll(i) {
    const n = daysIn(form.year, form.month);
    setWorker(i, { attendance: 'P'.repeat(n) + 'A'.repeat(31 - n) });
  }

  const monthDays = daysIn(form.year, form.month);
  const calc = workers.map((w) => {
    const days = w.attendance.slice(0, monthDays).split('').filter((c) => c === 'P').length;
    const gross = days * (Number(w.rate_per_day) || 0);
    return { days, gross, net: gross - (Number(w.fine) || 0) };
  });
  const total = calc.reduce((s, c) => s + c.net, 0);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!headId) { setError('कृपया लेखाशीर्ष निवडा'); return; }
    setBusy(true);
    try {
      const payload = {
        ...form, work_id: form.work_id || null, financial_year_id: yearId, ledger_head_id: headId,
        // महिन्याबाहेरच्या दिवसांची हजेरी काढून टाकतो
        workers: workers.map((w) => ({ ...w, attendance: w.attendance.slice(0, monthDays).padEnd(31, 'A') })),
      };
      const { data } = editingId ? await client.put(`/muster-rolls/${editingId}`, payload) : await client.post('/muster-rolls', payload);
      setEditingId(data.id);
      loadLists();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    if (!window.confirm(`एकूण मजुरी ${fmt(total)} रोकड वहीत खर्च म्हणून नोंदवायची का? (नंतर बदल करता येणार नाही)`)) return;
    setError('');
    setBusy(true);
    try {
      await client.post(`/muster-rolls/${editingId}/post`, {});
      setPosted(true);
      loadLists();
    } catch (err) {
      setError(err.response?.data?.error || 'पोस्ट करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('हा हजेरीपट मिटवायचा आहे का?')) return;
    try { await client.delete(`/muster-rolls/${editingId}`); resetForm(); loadLists(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आले नाही'); }
  }

  const canSave = editingId ? can('muster_rolls', 'edit') : can('muster_rolls', 'add');
  const locked = posted;

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>हजेरीपट नोंदणी (नमुना १९) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={editingId || ''} onChange={(e) => (e.target.value ? openRoll(e.target.value) : resetForm())} style={{ minWidth: 340 }}>
            <option value="">-- नवीन हजेरीपट / जुना निवडा --</option>
            {rolls.map((r) => (
              <option key={r.id} value={r.id}>{MONTHS[r.month - 1]} {r.year} - {r.work_name || r.title || 'हजेरीपट'} ({fmt(r.total_wages)}){r.cash_book_entry_id ? ' ✔' : ''}</option>
            ))}
          </select>
          {editingId && <button className="btn secondary" type="button" onClick={resetForm}>नवीन</button>}
        </div>
      </div>

      <form onSubmit={save}>
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <div className="form-grid">
            <div className="field">
              <label>काम (असल्यास)</label>
              <select value={form.work_id} disabled={locked} onChange={(e) => setForm({ ...form, work_id: e.target.value })}>
                <option value="">-- स्वतंत्र हजेरीपट --</option>
                {works.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="field"><label>हजेरीपटाचे शीर्षक/शेरा</label><input value={form.title} disabled={locked} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field">
              <label>महिना</label>
              <select value={form.month} disabled={locked} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field"><label>वर्ष</label><input type="number" value={form.year} disabled={locked} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>मजुरीसाठी खर्चाचे लेखाशीर्ष</label>
              <div className="combo-wrap">
                <input
                  value={headSearch} disabled={locked}
                  onChange={(e) => { setHeadSearch(e.target.value); setHeadId(''); setHeadOpen(true); }}
                  onFocus={() => setHeadOpen(true)}
                  placeholder="कोड किंवा नाव टाइप करा"
                  style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
                />
                {headOpen && !locked && (
                  <div className="combo-dropdown">
                    {headResults.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
                    {headResults.map((h) => (
                      <div key={h.id} className="combo-option" onMouseDown={() => { setHeadId(h.id); setHeadSearch(`${h.code} - ${h.name}`); setHeadOpen(false); }}>{h.code} - {h.name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card no-print">
          {workers.map((w, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <div className="form-grid">
                <div className="field"><label>मजुराचे नाव</label><input value={w.name} disabled={locked} onChange={(e) => setWorker(i, { name: e.target.value })} required /></div>
                <div className="field"><label>गाव/पत्ता</label><input value={w.address} disabled={locked} onChange={(e) => setWorker(i, { address: e.target.value })} /></div>
                <div className="field">
                  <label>स्त्री/पुरुष</label>
                  <select value={w.gender} disabled={locked} onChange={(e) => setWorker(i, { gender: e.target.value })}>
                    <option value="">-</option><option value="पुरुष">पुरुष</option><option value="स्त्री">स्त्री</option>
                  </select>
                </div>
                <div className="field"><label>कामाचे स्वरूप</label><input value={w.post} disabled={locked} onChange={(e) => setWorker(i, { post: e.target.value })} /></div>
                <div className="field"><label>रोजंदारी दर</label><input type="number" step="0.01" min="0" value={w.rate_per_day} disabled={locked} onChange={(e) => setWorker(i, { rate_per_day: e.target.value })} required /></div>
                <div className="field"><label>दंड/कपात</label><input type="number" step="0.01" min="0" value={w.fine} disabled={locked} onChange={(e) => setWorker(i, { fine: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                {Array.from({ length: monthDays }, (_, d) => (
                  <button
                    key={d} type="button" disabled={locked} onClick={() => toggleDay(i, d)}
                    style={{
                      width: 30, height: 30, padding: 0, fontSize: 12, borderRadius: 4, cursor: locked ? 'default' : 'pointer',
                      border: '1px solid var(--border)',
                      background: w.attendance[d] === 'P' ? 'var(--success, #2e7d32)' : 'transparent',
                      color: w.attendance[d] === 'P' ? '#fff' : 'inherit',
                    }}
                  >{d + 1}</button>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>दिवस: <strong>{calc[i].days}</strong></span>
                <span>मजुरी: <strong>{fmt(calc[i].gross)}</strong></span>
                <span>निव्वळ: <strong>{fmt(calc[i].net)}</strong></span>
                {!locked && <button type="button" className="btn secondary small" onClick={() => fillAll(i)}>सर्व दिवस हजर</button>}
                {!locked && workers.length > 1 && <button type="button" className="btn danger small" onClick={() => setWorkers(workers.filter((_, n) => n !== i))}>मजूर काढा</button>}
              </div>
            </div>
          ))}
          {!locked && <button type="button" className="btn secondary" onClick={() => setWorkers([...workers, blankWorker()])}>+ मजूर जोडा</button>}

          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>एकूण मजुरी: {fmt(total)}</strong>
            {!locked && canSave && <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'हजेरीपट जतन करा'}</button>}
            {editingId && !locked && can('muster_rolls', 'edit') && <button className="btn" type="button" disabled={busy} onClick={post}>रोकड वहीत नोंद करा</button>}
            {editingId && !locked && can('muster_rolls', 'delete') && <button className="btn danger" type="button" onClick={remove}>मिटवा</button>}
            {locked && <span style={{ color: 'var(--success)', fontWeight: 700 }}>रोकड वहीत नोंदवले ✔</span>}
          </div>
        </div>
      </form>
    </div>
  );
}
