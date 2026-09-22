import { useState } from 'react';
import client from '../../api/client';
import CloseReportButton from '../../components/CloseReportButton';

// संपूर्ण डेटाबेसचा (mysqldump) .sql बॅकअप डाउनलोड - फक्त प्रशासकासाठी
// (राऊटवर व सर्व्हरवरही requireAdmin, पहा maintenance.routes.js).
export default function BackupPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleBackup() {
    setError('');
    setBusy(true);
    try {
      const { data } = await client.get('/maintenance/backup', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      a.href = url;
      a.download = `gpweb-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('बॅकअप तयार करताना त्रुटी आली. सर्व्हर लॉग तपासा.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>बॅकअप</h1>
        <CloseReportButton />
      </div>
      <div className="card" style={{ maxWidth: 600 }}>
        <p>संपूर्ण डेटाबेसचा (सर्व मिळकती, कर आकारणी, जमा पावत्या, मास्टर याद्या) एक .sql फाईल स्वरूपात बॅकअप डाउनलोड होईल.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>ही फाईल सुरक्षित ठिकाणी जपून ठेवा - गरज पडल्यास "रि-स्टोअर" वापरून यातूनच डेटा परत आणता येईल.</p>
        {error && <div className="error-box">{error}</div>}
        <button className="btn" onClick={handleBackup} disabled={busy}>
          {busy ? 'बॅकअप तयार होत आहे...' : 'बॅकअप डाउनलोड करा'}
        </button>
      </div>
    </div>
  );
}
