import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const emptyForm = { name: '', unit: '', is_active: true };

// उपभोग्य वस्तू मास्टर (नमुना १५) - साठा नोंदणीत वस्तू येथूनच निवडतात.
export default function StockItemMaster() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  function load() { client.get('/stock/items').then(({ data }) => setRows(data)); }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await client.put(`/stock/items/${editingId}`, form); else await client.post('/stock/items', form);
      setForm(emptyForm); setEditingId(null); load();
    } catch (err) { setError(err.response?.data?.error || 'जतन करताना त्रुटी आली'); }
  }
  async function remove(id) {
    if (!window.confirm('ही वस्तू मिटवायची आहे का?')) return;
    try { await client.delete(`/stock/items/${id}`); load(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आले नाही'); }
  }

  return (
    <div className="page">
      <div className="page-header no-print"><h1>उपभोग्य वस्तू मास्टर (नमुना १५)</h1><CloseReportButton /></div>
      {error && <div className="error-box">{error}</div>}
      {(can('stock_items', 'add') || can('stock_items', 'edit')) && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>वस्तूचे नाव</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="field"><label>एकक (नग/लि./कि.ग्रॅ.)</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></div>
              {editingId && (
                <div className="field"><label>स्थिती</label>
                  <select value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}><option value="1">सक्रिय</option><option value="0">निष्क्रिय</option></select>
                </div>
              )}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">{editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>वस्तू</th><th>एकक</th><th>स्थिती</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                <td>{r.name}</td><td>{r.unit}</td><td>{r.is_active ? 'सक्रिय' : 'निष्क्रिय'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {can('stock_items', 'edit') && <button className="btn secondary small" type="button" onClick={() => { setEditingId(r.id); setForm({ name: r.name, unit: r.unit, is_active: !!r.is_active }); }}>संपादन</button>}
                  {can('stock_items', 'delete') && <button className="btn danger small" type="button" onClick={() => remove(r.id)}>मिटवा</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
