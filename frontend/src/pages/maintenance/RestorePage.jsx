import { useState } from 'react';
import client from '../../api/client';
import CloseReportButton from '../../components/CloseReportButton';

const CONFIRM_WORD = 'रिस्टोअर';

// .sql बॅकअप फाईलमधून संपूर्ण डेटाबेस परत आणतो - हे विद्यमान सर्व डेटावर
// (मिळकती, कर आकारणी, जमा पावत्या - सर्व) कायमचे overwrite करते, म्हणून
// टाईप-करून-खात्री (type-to-confirm) + native confirm() असे दोन सुरक्षा-टप्पे.
export default function RestorePage() {
  const [file, setFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const ready = file && confirmText.trim() === CONFIRM_WORD;

  async function handleRestore() {
    if (!ready) return;
    if (!window.confirm('खात्री आहे का? सध्याचा संपूर्ण डेटाबेस (सर्व मिळकती, कर आकारणी, जमा पावत्या) या फाईलमधील डेटाने कायमचा बदलला जाईल. ही क्रिया परत करता येणार नाही.')) return;

    setError('');
    setDone(false);
    setBusy(true);
    try {
      const text = await file.text();
      await client.post('/maintenance/restore', text, { headers: { 'Content-Type': 'text/plain' } });
      setDone(true);
      setFile(null);
      setConfirmText('');
    } catch (err) {
      setError(err.response?.data?.error || 'रि-स्टोअर करताना त्रुटी आली.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>रि-स्टोअर</h1>
        <CloseReportButton />
      </div>
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="notice-box" style={{ marginBottom: 14 }}>
          सावधान: रि-स्टोअर केल्यास सध्याचा संपूर्ण डेटाबेस (सर्व मिळकती, कर आकारणी, जमा पावत्या, मास्टर याद्या)
          कायमचा मिटून, निवडलेल्या बॅकअप फाईलमधील डेटा त्याची जागा घेईल. ही क्रिया परत करता येणार नाही.
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>बॅकअप फाईल (.sql)</label>
          <input type="file" accept=".sql" onChange={(e) => { setFile(e.target.files?.[0] || null); setDone(false); }} />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>खात्रीसाठी "{CONFIRM_WORD}" टाइप करा</label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} />
        </div>

        {error && <div className="error-box">{error}</div>}
        {done && <div className="notice-box" style={{ color: 'var(--success)' }}>रि-स्टोअर यशस्वी झाले.</div>}

        <button className="btn danger" onClick={handleRestore} disabled={!ready || busy}>
          {busy ? 'रि-स्टोअर करत आहे...' : 'रि-स्टोअर करा'}
        </button>
      </div>
    </div>
  );
}
