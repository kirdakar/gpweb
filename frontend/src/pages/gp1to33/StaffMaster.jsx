import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const EMPLOYMENT_TYPES = ['पूर्णकालिक', 'अंशकालिक'];

const emptyForm = {
  post_name: '', post_count: '1', sanction_order_no: '', sanction_date: '',
  employment_type: 'पूर्णकालिक', pay_scale: '', employee_name: '', appointment_date: '',
  is_active: true, remark: '',
};

// नमुना १३ - कर्मचारी सूची व वेतनश्रेणी नोंदवही. कोणती पदे मंजूर आहेत, कोण
// नियुक्त आहे याचा स्थिर रोस्टर - मासिक वेतन देयक (नमुना २१, दैनिक व्यवहार)
// याच यादीतील सक्रिय कर्मचाऱ्यांसाठी भरले जाते.
export default function StaffMaster() {
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    client.get('/staff').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      post_name: row.post_name || '', post_count: String(row.post_count ?? 1),
      sanction_order_no: row.sanction_order_no || '', sanction_date: row.sanction_date ? row.sanction_date.slice(0, 10) : '',
      employment_type: row.employment_type || 'पूर्णकालिक', pay_scale: row.pay_scale || '',
      employee_name: row.employee_name || '', appointment_date: row.appointment_date ? row.appointment_date.slice(0, 10) : '',
      is_active: !!row.is_active, remark: row.remark || '',
    });
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.post_name.trim()) { setError('पदनाम आवश्यक आहे'); return; }
    setBusy(true);
    try {
      const payload = { ...form, post_count: Number(form.post_count) || 1 };
      if (editingId) await client.put(`/staff/${editingId}`, payload);
      else await client.post('/staff', payload);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('ही नोंद मिटवायची आहे का?')) return;
    await client.delete(`/staff/${id}`);
    load();
  }

  const canEdit = can('staff_master', 'add') || can('staff_master', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर्मचारी सूची व वेतनश्रेणी (नमुना १३)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('staff_master', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>कर्मचारी सूची व वेतनश्रेणी नोंदवही (नमुना १३)</p>
      </div>

      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>पदनाम</label><input value={form.post_name} onChange={(e) => setForm({ ...form, post_name: e.target.value })} required /></div>
              <div className="field"><label>पदांची संख्या</label><input type="number" min="1" value={form.post_count} onChange={(e) => setForm({ ...form, post_count: e.target.value })} /></div>
              <div className="field"><label>मंजूर पद आदेश क्रमांक</label><input value={form.sanction_order_no} onChange={(e) => setForm({ ...form, sanction_order_no: e.target.value })} /></div>
              <div className="field"><label>आदेश दिनांक</label><input type="date" value={form.sanction_date} onChange={(e) => setForm({ ...form, sanction_date: e.target.value })} /></div>
              <div className="field">
                <label>पूर्णकालिक/अंशकालिक</label>
                <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>मंजूर वेतनश्रेणी</label><input value={form.pay_scale} onChange={(e) => setForm({ ...form, pay_scale: e.target.value })} /></div>
              <div className="field"><label>नियुक्त कर्मचाऱ्याचे नाव</label><input value={form.employee_name} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} /></div>
              <div className="field"><label>नियुक्तीचा दिनांक</label><input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} /></div>
              {editingId && (
                <div className="field">
                  <label>सद्यस्थिती</label>
                  <select value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}>
                    <option value="1">सक्रिय</option>
                    <option value="0">निष्क्रिय (सेवेतून बाहेर)</option>
                  </select>
                </div>
              )}
              <div className="field" style={{ gridColumn: 'span 2' }}><label>शेरा</label><input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'नोंद करा'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={cancelEdit}>रद्द करा</button>}
            </div>
          </form>
        </div>
      )}

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>पदनाम</th><th>संख्या</th><th>प्रकार</th><th>वेतनश्रेणी</th><th>कर्मचाऱ्याचे नाव</th><th>नियुक्ती दिनांक</th><th>स्थिती</th><th className="no-print"></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
                  <td>{r.post_name}</td>
                  <td>{r.post_count}</td>
                  <td>{r.employment_type}</td>
                  <td>{r.pay_scale || '-'}</td>
                  <td>{r.employee_name || '-'}</td>
                  <td>{r.appointment_date?.slice(0, 10) || '-'}</td>
                  <td>{r.is_active ? 'सक्रिय' : 'निष्क्रिय'}</td>
                  <td className="no-print" style={{ display: 'flex', gap: 6 }}>
                    {can('staff_master', 'edit') && <button className="btn secondary small" onClick={() => startEdit(r)}>संपादन</button>}
                    {can('staff_master', 'delete') && <button className="btn danger small" onClick={() => handleDelete(r.id)}>मिटवा</button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
