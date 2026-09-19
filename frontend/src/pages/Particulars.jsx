import { useEffect, useState } from 'react';
import client from '../api/client';
import { usePermissions } from '../context/PermissionsContext';

const emptyForm = {
  par_code: '', par_name: '', gharpatti_rate: '', jamin_rate: '', divabatti_rate: '', arogya_rate: '', panipatti_rate: '',
};

export default function Particulars() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/particulars');
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function selectRow(row) {
    setEditing(true);
    setForm({
      par_code: row.par_code, par_name: row.par_name,
      gharpatti_rate: row.gharpatti_rate, jamin_rate: row.jamin_rate,
      divabatti_rate: row.divabatti_rate, arogya_rate: row.arogya_rate, panipatti_rate: row.panipatti_rate,
    });
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
        await client.put(`/particulars/${form.par_code}`, form);
      } else {
        await client.post('/particulars', form);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    }
  }

  async function handleDelete(parCode) {
    if (!window.confirm('हा दर मिटवायचा आहे का?')) return;
    try {
      await client.delete(`/particulars/${parCode}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'मिटवताना त्रुटी आली');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>बांधकाम प्रकार / दर मास्टर</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>{editing ? `संपादन: कोड ${form.par_code}` : 'नवीन दर जोडा'}</h2>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>कोड (par_code)</label>
              <input required disabled={editing} type="number" value={form.par_code}
                onChange={(e) => setForm({ ...form, par_code: e.target.value })} />
            </div>
            <div className="field">
              <label>नाव (बांधकाम प्रकार)</label>
              <input required value={form.par_name} onChange={(e) => setForm({ ...form, par_name: e.target.value })} />
            </div>
            <div className="field">
              <label>घरपट्टी दर</label>
              <input type="number" step="0.001" value={form.gharpatti_rate} onChange={(e) => setForm({ ...form, gharpatti_rate: e.target.value })} />
            </div>
            <div className="field">
              <label>जमीन दर (प्रति चौ.मी.)</label>
              <input type="number" step="0.01" value={form.jamin_rate} onChange={(e) => setForm({ ...form, jamin_rate: e.target.value })} />
            </div>
            <div className="field">
              <label>दिवाबत्ती दर</label>
              <input type="number" step="0.01" value={form.divabatti_rate} onChange={(e) => setForm({ ...form, divabatti_rate: e.target.value })} />
            </div>
            <div className="field">
              <label>आरोग्य कर दर</label>
              <input type="number" step="0.01" value={form.arogya_rate} onChange={(e) => setForm({ ...form, arogya_rate: e.target.value })} />
            </div>
            <div className="field">
              <label>पाणीपट्टी दर</label>
              <input type="number" step="0.01" value={form.panipatti_rate} onChange={(e) => setForm({ ...form, panipatti_rate: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={!can('particulars', editing ? 'edit' : 'add')}>{editing ? 'अद्ययावत करा' : 'जतन करा'}</button>
            {editing && <button className="btn secondary" type="button" onClick={resetForm}>रद्द करा</button>}
          </div>
        </form>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>कोड</th><th>नाव</th><th className="num">घरपट्टी दर</th><th className="num">जमीन दर</th>
                <th className="num">दिवाबत्ती</th><th className="num">आरोग्य</th><th className="num">पाणीपट्टी</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.par_code}>
                  <td>{r.par_code}</td>
                  <td>{r.par_name}</td>
                  <td className="num">{Number(r.gharpatti_rate).toFixed(3)}</td>
                  <td className="num">{Number(r.jamin_rate).toFixed(2)}</td>
                  <td className="num">{Number(r.divabatti_rate).toFixed(2)}</td>
                  <td className="num">{Number(r.arogya_rate).toFixed(2)}</td>
                  <td className="num">{Number(r.panipatti_rate).toFixed(2)}</td>
                  <td>
                    {can('particulars', 'edit') && <button className="btn secondary small" onClick={() => selectRow(r)}>संपादन</button>}{' '}
                    {can('particulars', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.par_code)}>मिटवा</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
