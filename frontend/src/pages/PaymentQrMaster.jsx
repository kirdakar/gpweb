import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { usePermissions } from '../context/PermissionsContext';
import CloseReportButton from '../components/CloseReportButton';

// QR कोड मास्टर - घरपट्टी व पाणीपट्टी भरण्याचे QR चित्र टेबलमध्ये साठवते; हे चित्र कर मागणी बिल
// (नमुना ९क) वर छापले जाते, म्हणजे मालमत्ताधारक ते स्कॅन करून कर भरू शकतात.
const TYPES = [
  { key: 'gharpatti', label: 'घरपट्टी भरणा QR' },
  { key: 'panipatti', label: 'पाणीपट्टी भरणा QR' },
];
const MAX_SIDE = 800; // याहून मोठे चित्र आपोआप लहान करतो (QR साठी पुरेसे, डेटाबेसमध्ये हलके)

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('फाईल वाचता आली नाही'));
    fr.readAsDataURL(file);
  });
}

// मोठे चित्र असल्यास MAX_SIDE पर्यंत लहान करून PNG बनवते; लहान असेल तर तसेच ठेवते.
async function prepareImage(file) {
  const dataUrl = await readAsDataUrl(file);
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('हे चित्र उघडता आले नाही'));
    i.src = dataUrl;
  });
  if (Math.max(img.width, img.height) <= MAX_SIDE) return dataUrl;
  const k = MAX_SIDE / Math.max(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function QrCard({ type, info, canEdit, onChanged }) {
  const [preview, setPreview] = useState(null); // निवडलेले पण अजून जतन न केलेले चित्र (data URL)
  const [fileName, setFileName] = useState('');
  const [savedUrl, setSavedUrl] = useState(null);
  const [caption, setCaption] = useState(info?.caption || '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadSaved = useCallback(async () => {
    if (!info) { setSavedUrl(null); return; }
    try {
      const { data } = await client.get(`/payment-qr/${type.key}/image`, { responseType: 'blob' });
      setSavedUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(data); });
    } catch { setSavedUrl(null); }
  }, [info, type.key]);

  useEffect(() => { loadSaved(); }, [loadSaved, info?.updated_at]);
  useEffect(() => { setCaption(info?.caption || ''); }, [info?.caption]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setNotice('');
    try {
      setPreview(await prepareImage(file));
      setFileName(file.name);
    } catch (err) {
      setError(err.message);
    }
  }

  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      await client.put(`/payment-qr/${type.key}`, { image: preview || undefined, file_name: fileName || undefined, caption });
      setPreview(null); setFileName('');
      setNotice('जतन झाले.');
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`${type.label} मिटवायचा आहे का?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await client.delete(`/payment-qr/${type.key}`);
      setPreview(null); setCaption('');
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'मिटवताना त्रुटी आली');
    } finally { setBusy(false); }
  }

  const shown = preview || savedUrl;
  return (
    <div className="card" style={{ flex: '1 1 min(320px, 100%)', maxWidth: 420, minWidth: 0 }}>
      <h2 style={{ fontSize: 15, marginTop: 0 }}>{type.label}</h2>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="notice-box">{notice}</div>}
      <div style={{ width: 220, height: 220, border: '1px dashed var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', marginBottom: 12 }}>
        {shown ? (
          <a href={shown} target="_blank" rel="noopener noreferrer" title="मोठे पाहण्यासाठी क्लिक करा (नवीन टॅबमध्ये उघडते)" style={{ display: 'contents' }}>
            <img src={shown} alt={type.label} style={{ maxWidth: '100%', maxHeight: '100%', cursor: 'zoom-in' }} />
          </a>
        ) : <span style={{ color: 'var(--text-muted)' }}>QR चित्र नोंदवलेले नाही</span>}
      </div>
      {shown && (
        <p style={{ margin: '-6px 0 10px', fontSize: 12, color: preview ? 'var(--danger)' : 'var(--text-muted)' }}>
          {preview ? 'हे नवीन निवडलेले चित्र आहे (अजून जतन केलेले नाही). ' : 'हे जतन केलेले चित्र आहे. '}
          मोठे पाहण्यासाठी चित्रावर क्लिक करा.{info?.file_name && !preview ? ` (फाईल: ${info.file_name})` : ''}
        </p>
      )}
      {canEdit && (
        <>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>QR चित्र निवडा (PNG / JPG)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPick} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>चित्राखाली छापायचा मजकूर (उदा. UPI आयडी)</label>
            <input maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="उदा. gpanandnagar@upi" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="button" onClick={save} disabled={busy || (!preview && !info)}>
              {preview ? 'नवीन चित्र जतन करा' : 'जतन करा'}
            </button>
            {info && <button className="btn danger" type="button" onClick={remove} disabled={busy}>मिटवा</button>}
          </div>
          {preview && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>वरील चित्र अजून जतन केलेले नाही - "नवीन चित्र जतन करा" दाबा.</p>}
        </>
      )}
    </div>
  );
}

export default function PaymentQrMaster() {
  const { can } = usePermissions();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    client.get('/payment-qr').then(({ data }) => setList(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page data-entry-page">
      <div className="page-header">
        <h1>QR कोड मास्टर (घरपट्टी / पाणीपट्टी भरणा)</h1>
        <CloseReportButton />
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        ग्रामपंचायतीचे घरपट्टी व पाणीपट्टी भरण्याचे QR कोड चित्र इथे एकदा नोंदवा. ही चित्रे कर मागणी बिल (नमुना ९क) वर आपोआप छापली
        जातात - मालमत्ताधारक ते स्कॅन करून कर भरू शकतात.
      </p>
      {loading ? <p>लोड होत आहे...</p> : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {TYPES.map((t) => (
            <QrCard key={t.key} type={t} info={list.find((x) => x.qr_type === t.key)} canEdit={can('payment_qr', 'edit')} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
