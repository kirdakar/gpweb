import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const emptyForm = { description: '', unit: '', rate: '', is_active: true };

// दरसूची (Schedule of Rates) मास्टर - कामाच्या अंदाजात (नमुना २०) ओळ निवडली की
// तपशील/एकक/दर येथूनच येतात, पुन्हा टाईप करायचे नाहीत.
export default function RateScheduleMaster() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    client.get('/rate-schedule').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function startEdit(r) {
    setEditingId(r.id);
    setForm({ description: r.description, unit: r.unit, rate: String(r.rate), is_active: !!r.is_active });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editingId) await client.put(`/rate-schedule/${editingId}`, form);
      else await client.post('/rate-schedule', form);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('ही ओळ मिटवायची आहे का?')) return;
    try { await client.delete(`/rate-schedule/${id}`); load(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आले नाही'); }
  }

  const term = search.trim().toLowerCase();
  const shown = term ? rows.filter((r) => r.description.toLowerCase().includes(term)) : rows;
  const canEdit = can('rate_schedule', 'add') || can('rate_schedule', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>दरसूची मास्टर</h1>
        <CloseReportButton />
      </div>

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}><label>कामाचा तपशील</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
              <div className="field"><label>एकक (घ.मी./चौ.मी./मी./नग)</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></div>
              <div className="field"><label>दर (रु.)</label><input type="number" step="0.01" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required /></div>
              {editingId && (
                <div className="field">
                  <label>स्थिती</label>
                  <select value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}>
                    <option value="1">सक्रिय</option>
                    <option value="0">निष्क्रिय</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}
      {!canEdit && error && <div className="error-box">{error}</div>}

      <div className="search-bar no-print"><input placeholder="तपशील शोधा" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>तपशील</th><th>एकक</th><th className="num">दर</th><th>स्थिती</th><th className="no-print"></th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                  <td>{r.description}</td>
                  <td>{r.unit}</td>
                  <td className="num">{Number(r.rate).toFixed(2)}</td>
                  <td>{r.is_active ? 'सक्रिय' : 'निष्क्रिय'}</td>
                  <td className="no-print" style={{ display: 'flex', gap: 6 }}>
                    {can('rate_schedule', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                    {can('rate_schedule', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>नोंद नाही</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
