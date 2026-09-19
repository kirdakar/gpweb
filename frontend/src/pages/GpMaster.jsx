import { useEffect, useState } from 'react';
import client from '../api/client';
import { usePermissions } from '../context/PermissionsContext';
import useDebouncedValue from '../hooks/useDebouncedValue';

const emptyForm = { code: '', owner_name: '' };

export default function GpMaster() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/gpmaster', { params: { search: debouncedSearch } });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [debouncedSearch]);

  function selectRow(row) {
    setEditing(true);
    setForm({ code: row.code, owner_name: row.owner_name });
    setError('');
  }

  function resetForm() {
    setEditing(false);
    setForm(emptyForm);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await client.put(`/gpmaster/${form.code}`, { owner_name: form.owner_name });
      } else {
        await client.post('/gpmaster', form);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }

  async function handleDelete(code) {
    if (!window.confirm(`कोड ${code} मिटवायचा आहे का?`)) return;
    try {
      await client.delete(`/gpmaster/${code}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'मिटवताना त्रुटी आली');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>मिळकतदार मास्टर (GPMASTER)</h1>
      </div>

      {can('gpmaster', editing ? 'edit' : 'add') && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>{editing ? `संपादन: कोड ${form.code}` : 'नवीन कोड जोडा'}</h2>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>कोड</label>
                <input required disabled={editing} type="number" value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="field">
                <label>मालकाचे नांव</label>
                <input required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">{editing ? 'अद्ययावत करा' : 'जतन करा'}</button>
              {editing && <button className="btn secondary" type="button" onClick={resetForm}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      <div className="search-bar">
        <input placeholder="कोड किंवा मालकाचे नाव टाइप करा (शोध आपोआप होतो)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>कोड</th><th>मालकाचे नांव</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td>
                  <td>{r.owner_name}</td>
                  <td>
                    {can('gpmaster', 'edit') && <button className="btn secondary small" onClick={() => selectRow(r)}>संपादन</button>}{' '}
                    {can('gpmaster', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.code)}>मिटवा</button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>नोंदी सापडल्या नाहीत</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
