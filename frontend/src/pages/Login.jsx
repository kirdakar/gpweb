import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Login() {
  const { login } = useAuth();
  // लॉगिन पान उघडताच (टायपिंग सुरू असतानाच) बॅकएंडशी हलकी विनंती पाठवून
  // जोडणी आधीच "गरम" करतो - Cloudflare Tunnel वरील पहिल्याच विनंतीचा TLS/बोगदा
  // हँडशेक (सुमारे ४००-५०० ms) यामुळे लॉगिन बटण दाबण्याआधीच पूर्ण होतो, त्यामुळे
  // प्रत्यक्ष लॉगिन विनंती जलद (फक्त गरम कनेक्शनचा वेळ) मिळते.
  useEffect(() => { client.get('/health').catch(() => {}); }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      const dest = location.state?.from || '/';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'लॉगिन अयशस्वी झाले');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 340 }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>ग्रामपंचायत मिळकत कर व्यवस्थापन</h1>
        {error && <div className="error-box">{error}</div>}
        <div className="field" style={{ marginBottom: 12 }}>
          <label>वापरकर्तानाव</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>पासवर्ड</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'प्रवेश करत आहे...' : 'लॉगिन'}
        </button>
      </form>
    </div>
  );
}
