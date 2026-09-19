import { useEffect, useState } from 'react';
import client from '../api/client';
import { usePermissions } from '../context/PermissionsContext';

export default function Settings() {
  const { can } = usePermissions();
  const [form, setForm] = useState({ gp_name: '', taluka: '', district: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/settings').then(({ data }) => setForm(data)).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const { data } = await client.put('/settings', form);
      setForm(data);
      setNotice('जतन झाले.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><p>लोड होत आहे...</p></div>;

  return (
    <div className="page">
      <div className="page-header"><h1>ग्रामपंचायत माहिती (Settings)</h1></div>
      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 13 }}>
          ही माहिती नमुना नं. ८ (आकारणी यादी) आणि इतर छापील अहवालांच्या शीर्षकावर दिसते.
        </p>
        {notice && <div className="notice-box">{notice}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>ग्रामपंचायतीचे नाव</label>
            <input value={form.gp_name} onChange={(e) => setForm({ ...form, gp_name: e.target.value })} placeholder="उदा. ग्रामपंचायत आनंदनगर" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>तालुका</label>
            <input value={form.taluka} onChange={(e) => setForm({ ...form, taluka: e.target.value })} placeholder="उदा. माळशिरस" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>जिल्हा</label>
            <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="उदा. सोलापूर" />
          </div>
          <button className="btn" type="submit" disabled={busy || !can('settings', 'edit')}>जतन करा</button>
        </form>
      </div>
    </div>
  );
}
