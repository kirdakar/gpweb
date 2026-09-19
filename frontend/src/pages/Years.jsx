import { useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';

export default function Years() {
  const { years, refresh } = useYear();
  const { can } = usePermissions();
  const [label, setLabel] = useState('');
  const [carryForward, setCarryForward] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^\d{4}-\d{4}$/.test(label)) {
      setError('वर्ष "YYYY-YYYY" या स्वरूपात लिहा, उदा. 2026-2027');
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post('/years', { year_label: label, carry_forward: carryForward });
      setLabel('');
      if (data.carried_forward_from) {
        setNotice(`वर्ष "${data.year_label}" जोडले. मागील वर्ष "${data.carried_forward_from}" मधील ${data.carried_forward_count} मालमत्तांचा कर तपशील नवीन वर्षात कॉपी केला — आता फक्त बदल झालेले आकडे संपादित करा.`);
      } else if (carryForward) {
        setNotice(`वर्ष "${data.year_label}" जोडले. कॉपी करण्यासाठी आधीचे वर्ष सापडले नाही (हे पहिलेच वर्ष आहे).`);
      } else {
        setNotice(`वर्ष "${data.year_label}" जोडले (डेटा कॉपी न करता).`);
      }
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setBusy(false);
    }
  }

  async function activate(id) {
    await client.patch(`/years/${id}/activate`);
    refresh();
  }

  return (
    <div className="page">
      <div className="page-header"><h1>आर्थिक वर्ष व्यवस्थापन</h1></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 13 }}>
          जुन्या प्रणालीत प्रत्येक नवीन वर्षासाठी टेबलमध्ये स्तंभ जोडावे लागत असत (उदा. GAHARPATI / OGAHARPATI).
          इथे फक्त नवीन वर्ष जोडा — रचना बदलण्याची गरज नाही. नवीन वर्ष जोडताना मागील वर्षाचा कर तपशील
          आपोआप नवीन वर्षात कॉपी होतो, जेणेकरून प्रत्येक मालमत्ता पुन्हा नव्याने भरावी लागणार नाही.
        </p>
        {error && <div className="error-box">{error}</div>}
        {notice && <div className="notice-box">{notice}</div>}
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="उदा. 2026-2027" value={label} onChange={(e) => setLabel(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, width: 200 }} />
            <button className="btn" disabled={busy || !can('years', 'add')}>वर्ष जोडा</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13, fontWeight: 400 }}>
            <input type="checkbox" checked={carryForward} onChange={(e) => setCarryForward(e.target.checked)} />
            मागील वर्षाचा कर तपशील नवीन वर्षात कॉपी करा
          </label>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>वर्ष</th><th>स्थिती</th><th></th></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id}>
                <td>{y.year_label}</td>
                <td>{y.is_active ? <span className="badge success">चालू वर्ष</span> : <span className="badge">निष्क्रिय</span>}</td>
                <td>{!y.is_active && can('years', 'add') && <button className="btn secondary small" onClick={() => activate(y.id)}>चालू वर्ष करा</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
