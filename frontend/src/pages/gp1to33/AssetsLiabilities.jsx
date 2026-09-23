import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना ४ - पंचायतीचे भत्ते व दायित्वे. दोन्ही बाजूंचे विषय कायद्याने
// ठरलेले (स्थिर यादी) - फक्त रक्कम भरायची/बदलायची.
export default function AssetsLiabilities() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();

  const [liabilities, setLiabilities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/assets-liabilities', { params: { financialYearId: yearId } })
      .then(({ data }) => {
        setLiabilities(data['दायित्वे'] || []);
        setAssets(data['भत्ता'] || []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  function updateAmount(side, code, value) {
    const setter = side === 'दायित्वे' ? setLiabilities : setAssets;
    setter((list) => list.map((item) => (item.code === code ? { ...item, amount: value } : item)));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const entries = [...liabilities, ...assets].map((item) => ({ item_code: item.code, amount: Number(item.amount || 0) }));
      await client.put('/assets-liabilities', { financial_year_id: yearId, entries });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setSaving(false);
    }
  }

  const liabilitiesTotal = liabilities.reduce((s, i) => s + Number(i.amount || 0), 0);
  const assetsTotal = assets.reduce((s, i) => s + Number(i.amount || 0), 0);
  const canEdit = can('assets_liabilities', 'edit');

  function ItemTable({ title, list, side }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>क्र.</th><th>तपशील</th><th className="num">रक्कम</th></tr></thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.code}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.code}</td>
                  <td>{item.name}</td>
                  <td className="num">
                    {canEdit ? (
                      <input
                        type="number" step="0.01" value={item.amount}
                        onChange={(e) => updateAmount(side, item.code, e.target.value)}
                        style={{ width: 140, padding: 4, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }}
                      />
                    ) : Number(item.amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row"><td colSpan={2}>एकूण</td><td className="num">{list.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>पंचायतीचे भत्ते व दायित्वे (नमुना ४) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'जतन करा'}</button>}
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('assets_liabilities', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {error && <div className="error-box no-print">{error}</div>}

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>पंचायतीचे भत्ते व दायित्वे (नमुना ४)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <ItemTable title="दायित्वे (Liabilities)" list={liabilities} side="दायित्वे" />
          <ItemTable title="भत्ता (Assets / येणे रकमा)" list={assets} side="भत्ता" />
          <div className="card" style={{ maxWidth: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>एकूण दायित्वे</span><strong>{liabilitiesTotal.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>एकूण भत्ता</span><strong>{assetsTotal.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <span>निव्वळ (भत्ता - दायित्वे)</span><strong>{(assetsTotal - liabilitiesTotal).toFixed(2)}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
