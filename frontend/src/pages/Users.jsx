import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = { username: '', password: '', full_name: '', role: 'user' };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null); // user id being edited, or null
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null); // user id whose password is being reset
  const [newPassword, setNewPassword] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/users');
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function selectRow(row) {
    setEditing(row.id);
    setForm({ username: row.username, password: '', full_name: row.full_name || '', role: row.role });
    setError('');
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await client.put(`/users/${editing}`, { full_name: form.full_name, role: form.role });
      } else {
        await client.post('/users', form);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`वापरकर्ता "${row.username}" मिटवायचा आहे का?`)) return;
    try {
      await client.delete(`/users/${row.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'मिटवताना त्रुटी आली');
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    try {
      await client.post(`/users/${resetTarget.id}/reset-password`, { newPassword });
      setResetTarget(null);
      setNewPassword('');
      alert('Password बदलले.');
    } catch (err) {
      alert(err.response?.data?.error || 'Password बदलताना त्रुटी आली');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>यूजर मास्टर</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>{editing ? `संपादन: ${form.username}` : 'नवीन वापरकर्ता जोडा'}</h2>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Username</label>
              <input required disabled={!!editing} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            {!editing && (
              <div className="field">
                <label>Password</label>
                <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="field">
              <label>पूर्ण नाव</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>भूमिका (Role)</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">वापरकर्ता (अधिकारांनुसार नियंत्रित)</option>
                <option value="admin">प्रशासक (सर्व अधिकार)</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn" type="submit">{editing ? 'अद्ययावत करा' : 'जतन करा'}</button>
            {editing && <button className="btn secondary" type="button" onClick={resetForm}>रद्द करा</button>}
          </div>
        </form>
      </div>

      {resetTarget && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Password बदला: {resetTarget.username}</h2>
          <form onSubmit={handleResetPassword} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input required type="password" placeholder="नवीन Password (किमान 6 अक्षरी)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, width: 260 }} />
            <button className="btn" type="submit">जतन करा</button>
            <button className="btn secondary" type="button" onClick={() => { setResetTarget(null); setNewPassword(''); }}>रद्द करा</button>
          </form>
        </div>
      )}

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Username</th><th>पूर्ण नाव</th><th>भूमिका</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.username}</td>
                  <td>{r.full_name || '-'}</td>
                  <td>{r.role === 'admin' ? <span className="badge success">प्रशासक</span> : <span className="badge">वापरकर्ता</span>}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => selectRow(r)}>संपादन</button>{' '}
                    {r.role !== 'admin' && (
                      <Link className="btn secondary small" to={`/users/${r.id}/rights`}>अधिकार</Link>
                    )}{' '}
                    <button className="btn secondary small" onClick={() => setResetTarget(r)}>Password बदला</button>{' '}
                    {r.id !== me.id && <button className="btn danger small" onClick={() => handleDelete(r)}>मिटवा</button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>वापरकर्ते सापडले नाहीत</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
