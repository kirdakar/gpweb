import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { move_date: today(), kind: 'मिळाले', quantity: '', purpose_to: '', officer_name: '', receiver_name: '', remark: '' };

// नमुना १५ - उपभोग्य वस्तू साठा. वस्तू निवडा; प्रारंभिक/मिळालेले/दिलेले नोंदवा.
// प्रारंभिक शिल्लक, एकूण व शिल्लक आपोआप मोजली जाते.
export default function StockEntry() {
  const { can } = usePermissions();
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [data, setData] = useState({ movements: [], balance: 0 });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { client.get('/stock/items', { params: { activeOnly: 1 } }).then(({ data: d }) => setItems(d)); }, []);
  function load() {
    if (!itemId) { setData({ movements: [], balance: 0 }); return; }
    client.get('/stock/movements', { params: { itemId } }).then(({ data: d }) => setData(d));
  }
  useEffect(() => { load(); }, [itemId]);

  const item = items.find((i) => String(i.id) === String(itemId));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post('/stock/movements', { ...form, item_id: itemId });
      setForm({ ...emptyForm, kind: form.kind }); load();
    } catch (err) { setError(err.response?.data?.error || 'नोंद करताना त्रुटी आली'); } finally { setBusy(false); }
  }
  async function remove(id) {
    setError('');
    try { await client.delete(`/stock/movements/${id}`); load(); } catch (err) { setError(err.response?.data?.error || 'मिटवता आले नाही'); }
  }

  return (
    <div className="page">
      <div className="page-header no-print"><h1>उपभोग्य वस्तू साठा नोंदणी (नमुना १५)</h1><CloseReportButton /></div>
      {error && <div className="error-box">{error}</div>}
      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ minWidth: 300 }}>
            <option value="">-- वस्तू निवडा --</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
          {item && <strong>सध्याची शिल्लक: {data.balance} {item.unit}</strong>}
        </div>
        {item && can('stock_register', 'add') && (
          <form onSubmit={submit} style={{ marginTop: 14 }}>
            <div className="form-grid">
              <div className="field"><label>तारीख</label><input type="date" value={form.move_date} onChange={(e) => setForm({ ...form, move_date: e.target.value })} required /></div>
              <div className="field"><label>प्रकार</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {data.movements.length === 0 && <option value="प्रारंभिक">प्रारंभिक शिल्लक</option>}
                  <option value="मिळाले">मिळालेले</option><option value="दिले">दिलेले</option>
                </select>
              </div>
              <div className="field"><label>संख्या/परिमाण ({item.unit})</label><input type="number" step="0.001" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></div>
              {form.kind === 'दिले' && (
                <>
                  <div className="field"><label>कोणास/कोणत्या प्रयोजनासाठी</label><input value={form.purpose_to} onChange={(e) => setForm({ ...form, purpose_to: e.target.value })} /></div>
                  <div className="field"><label>वस्तू देणाऱ्या अधिकाऱ्याचे नाव</label><input value={form.officer_name} onChange={(e) => setForm({ ...form, officer_name: e.target.value })} /></div>
                  <div className="field"><label>वस्तू घेणाऱ्या व्यक्तीचे नाव</label><input value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} /></div>
                </>
              )}
              <div className="field"><label>शेरा</label><input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit" disabled={busy}>नोंदवा</button></div>
          </form>
        )}
      </div>
      {item && (
        <div className="card no-print">
          <div className="table-wrap">
            <table>
              <thead><tr><th>तारीख</th><th className="num">प्रारंभिक शिल्लक</th><th className="num">मिळालेले</th><th className="num">एकूण</th><th>कोणास/प्रयोजन</th><th className="num">दिलेले</th><th className="num">शिल्लक</th><th></th></tr></thead>
              <tbody>
                {data.movements.map((m, i) => (
                  <tr key={m.id}>
                    <td>{fmtDate(m.move_date)}</td><td className="num">{m.opening_before}</td><td className="num">{m.received || ''}</td><td className="num">{m.total_available}</td>
                    <td>{m.purpose_to || '-'}</td><td className="num">{m.issued || ''}</td><td className="num"><strong>{m.balance_after}</strong></td>
                    <td>{can('stock_register', 'delete') && i === data.movements.length - 1 && <button className="btn danger small" type="button" onClick={() => remove(m.id)}>मिटवा</button>}</td>
                  </tr>
                ))}
                {data.movements.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>अद्याप नोंद नाही</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
