import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { ACTION_LABELS } from '../constants/actionLabels';
import CloseReportButton from '../components/CloseReportButton';

export default function UserRights() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [targetUser, setTargetUser] = useState(null);
  const [screens, setScreens] = useState([]);
  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get('/users'),
      client.get('/users/screens'),
      client.get(`/users/${id}/permissions`),
    ]).then(([usersRes, screensRes, permsRes]) => {
      const u = usersRes.data.find((x) => String(x.id) === String(id));
      setTargetUser(u || null);
      setScreens(screensRes.data);
      setPerms(permsRes.data);
    }).finally(() => setLoading(false));
  }, [id]);

  // सर्व screens मध्ये कुठे-कुठे कोणती action लागू आहे यावरून स्तंभ ठरतात -
  // प्रत्येक स्क्रीनला सर्व actions लागू नसतात (उदा. 'years'ला 'delete' नाही).
  const columns = useMemo(() => {
    const set = new Set();
    for (const s of screens) for (const a of s.actions) set.add(a);
    const order = ['view', 'add', 'edit', 'delete', 'print'];
    return order.filter((a) => set.has(a));
  }, [screens]);

  function toggle(screenCode, actionCode) {
    const key = `${screenCode}:${actionCode}`;
    setPerms((p) => ({ ...p, [key]: !p[key] }));
  }

  function toggleRow(screen, value) {
    setPerms((p) => {
      const next = { ...p };
      for (const a of screen.actions) next[`${screen.code}:${a}`] = value;
      return next;
    });
  }

  function toggleColumn(actionCode, value) {
    setPerms((p) => {
      const next = { ...p };
      for (const s of screens) if (s.actions.includes(actionCode)) next[`${s.code}:${actionCode}`] = value;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await client.put(`/users/${id}/permissions`, perms);
      setNotice('अधिकार जतन केले.');
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><p>लोड होत आहे...</p></div>;

  if (!targetUser) {
    return (
      <div className="page">
        <div className="page-header"><h1>अधिकार</h1><CloseReportButton /></div>
        <div className="error-box">वापरकर्ता सापडला नाही.</div>
        <button className="btn secondary" onClick={() => navigate('/users')}>यूजर मास्टरकडे परत जा</button>
      </div>
    );
  }

  if (targetUser.role === 'admin') {
    return (
      <div className="page">
        <div className="page-header"><h1>अधिकार — {targetUser.username}</h1><CloseReportButton /></div>
        <p style={{ color: 'var(--text-muted)' }}>प्रशासक (admin) वापरकर्त्याला नेहमी सर्व अधिकार असतात - इथे बदल करण्याची गरज नाही.</p>
        <button className="btn secondary" onClick={() => navigate('/users')}>यूजर मास्टरकडे परत जा</button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>अधिकार — {targetUser.full_name || targetUser.username} ({targetUser.username})</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'अधिकार जतन करा'}</button>
          <button className="btn secondary" onClick={() => navigate('/users')}>यूजर मास्टरकडे परत जा</button>
          <CloseReportButton />
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="notice-box">{notice}</div>}

      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        प्रत्येक स्क्रीन (फॉर्म) समोर त्यावर लागू असलेली बटणे/कृती दिसतात. टिक न केलेली कृती
        या वापरकर्त्याला दिसणार/वापरता येणार नाही. डावीकडील/वरील "सर्व" ने संपूर्ण ओळ/स्तंभ एकदम टिक होतो.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>स्क्रीन / फॉर्म</th>
              {columns.map((a) => (
                <th key={a} className="num">
                  {ACTION_LABELS[a] || a}
                  <div>
                    <button type="button" className="btn secondary small" style={{ marginTop: 4, padding: '2px 6px', fontSize: 11 }}
                      onClick={() => toggleColumn(a, true)}>सर्व</button>{' '}
                    <button type="button" className="btn secondary small" style={{ marginTop: 4, padding: '2px 6px', fontSize: 11 }}
                      onClick={() => toggleColumn(a, false)}>काहीच नाही</button>
                  </div>
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {screens.map((s) => (
              <tr key={s.code}>
                <td>{s.label}</td>
                {columns.map((a) => (
                  <td key={a} className="num">
                    {s.actions.includes(a) ? (
                      <input type="checkbox" checked={!!perms[`${s.code}:${a}`]} onChange={() => toggle(s.code, a)} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                ))}
                <td>
                  <button type="button" className="btn secondary small" onClick={() => toggleRow(s, true)}>सर्व</button>{' '}
                  <button type="button" className="btn secondary small" onClick={() => toggleRow(s, false)}>काहीच नाही</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
