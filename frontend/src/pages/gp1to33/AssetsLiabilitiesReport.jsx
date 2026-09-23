import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना ४ - पंचायतीचे भत्ते व दायित्वे अहवाल (प्रिंट). डाटाएंट्री
// AssetsLiabilities.jsx (दैनिक व्यवहार) वर; हे फक्त वाचनीय स्वरूप.
export default function AssetsLiabilitiesReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();

  const [liabilities, setLiabilities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const liabilitiesTotal = liabilities.reduce((s, i) => s + Number(i.amount || 0), 0);
  const assetsTotal = assets.reduce((s, i) => s + Number(i.amount || 0), 0);

  function ItemTable({ title, list }) {
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
                  <td className="num">{Number(item.amount || 0).toFixed(2)}</td>
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
        <h1>पंचायतीचे भत्ते व दायित्वे अहवाल (नमुना ४) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_assets_liabilities', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>पंचायतीचे भत्ते व दायित्वे (नमुना ४)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <ItemTable title="दायित्वे (Liabilities)" list={liabilities} />
          <ItemTable title="भत्ता (Assets / येणे रकमा)" list={assets} />
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
