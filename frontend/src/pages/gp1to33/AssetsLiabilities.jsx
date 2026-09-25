import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// नमुना ४ - पंचायतीचे भत्ते व दायित्वे नोंदणी. दोन्ही बाजूंचे विषय कायद्याने
// ठरलेले (स्थिर यादी) - फक्त रक्कम भरायची/बदलायची. प्रिंट स्वरूप रिपोर्ट
// मेन्यूतील AssetsLiabilitiesReport.jsx वर आहे.
export default function AssetsLiabilities() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

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
                  <td>{item.name}{item.derived && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> ({item.derived_from === 'tax' ? `आकारणी व कर जमा भरणे वरून आपोआप${item.adjustment && (item.adjustment.discount > 0 || item.adjustment.penalty > 0) ? ` - सूट ₹${item.adjustment.discount.toFixed(2)} वजा, दंड ₹${item.adjustment.penalty.toFixed(2)} समाविष्ट` : ''}` : 'मालमत्ता नोंदणीवरून आपोआप'})</span>}</td>
                  <td className="num">
                    {canEdit && !item.derived ? (
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
        <h1>पंचायतीचे भत्ते व दायित्वे नोंदणी (नमुना ४) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'जतन करा'}</button>}
          <CloseReportButton />
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <ItemTable title="दायित्वे (Liabilities)" list={liabilities} side="दायित्वे" />
          <ItemTable title="भत्ता (Assets / येणे रकमा)" list={assets} side="भत्ता" />
        </>
      )}
    </div>
  );
}
