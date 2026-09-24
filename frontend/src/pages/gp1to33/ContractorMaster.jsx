import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const emptyForm = { name: '', address: '', phone: '', is_active: true };

// कंत्राटदार मास्टर - कामाचे देयक (नमुना २०ख) साठी. मिटवण्याऐवजी निष्क्रिय करता येते.
export default function ContractorMaster() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    client.get('/contractors').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function startEdit(r) {
    setEditingId(r.id);
    setForm({ name: r.name, address: r.address || '', phone: r.phone || '', is_active: !!r.is_active });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('नाव आवश्यक आहे'); return; }
    setBusy(true);
    try {
      if (editingId) await client.put(`/contractors/${editingId}`, form);
      else await client.post('/contractors', form);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('हा कंत्राटदार मिटवायचा आहे का?')) return;
    try { await client.delete(`/contractors/${id}`); load(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आला नाही'); }
  }

  const canEdit = can('contractors', 'add') || can('contractors', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कंत्राटदार मास्टर</h1>
        <CloseReportButton />
      </div>

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>कंत्राटदाराचे नाव</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="field"><label>पत्ता</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="field"><label>मोबाईल</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
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

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>नाव</th><th>पत्ता</th><th>मोबाईल</th><th>स्थिती</th><th className="no-print"></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                  <td>{r.name}</td>
                  <td>{r.address || '-'}</td>
                  <td>{r.phone || '-'}</td>
                  <td>{r.is_active ? 'सक्रिय' : 'निष्क्रिय'}</td>
                  <td className="no-print" style={{ display: 'flex', gap: 6 }}>
                    {can('contractors', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                    {can('contractors', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
