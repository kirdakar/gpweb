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
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

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

  const amt = (list, code) => Number((list.find((i) => i.code === code) || {}).amount || 0);
  const sumOf = (list, codes) => codes.reduce((s, c) => s + amt(list, c), 0);
  const fmt = (n) => Number(n || 0).toFixed(2);

  const liabilitiesTotal = liabilities.reduce((s, i) => s + Number(i.amount || 0), 0);
  const assetsTotal = assets.reduce((s, i) => s + Number(i.amount || 0), 0);

  // कागदी नमुना ४ प्रमाणे डावीकडे दायित्वे, उजवीकडे भत्ता (येणे रकमा); एकूण ओळी आकड्यांवरून काढलेल्या.
  const L = (no, label, code, extra = {}) => ({ no, label, amount: code ? amt(liabilities, code) : null, ...extra });
  const A = (no, label, code, extra = {}) => ({ no, label, amount: code ? amt(assets, code) : null, ...extra });
  const left = [
    L('१.', 'ग्रामपंचायतीकडून देय असलेल्या थकीत रकमा', null),
    L('', 'थकीत देयके', null, { bold: true }),
    L('', '(क) वेतन', 'L1a', { indent: 1 }),
    L('', '(ख) वेतनाव्यतिरिक्त इतर आस्थापना', 'L1b', { indent: 1 }),
    L('', '(ग) साधनसामग्री', 'L1c', { indent: 1 }),
    L('', '(घ) बांधकाम', 'L1d', { indent: 1 }),
    L('', '(ङ) इतर', 'L1e', { indent: 1 }),
    { no: '', label: 'एकूण (१) (क) ते (ङ)', amount: sumOf(liabilities, ['L1a', 'L1b', 'L1c', 'L1d', 'L1e']), bold: true, right: true },
    L('२.', 'कर्ज, हप्ता व कर्जावरील व्याज हप्ता', 'L2'),
    L('३.', 'इतर देय रकमा', 'L3'),
    L('४.', 'ठेवी परतावा बाकी', 'L4'),
    L('५.', 'समाजकल्याण अनुशेष', 'L5'),
    L('६.', 'महिला व बालकल्याण अनुशेष', 'L6'),
    L('७.', 'इतर अनुशेष', 'L7'),
    { no: '', label: 'एकूण १ ते ७', amount: liabilitiesTotal, bold: true, right: true },
  ];
  const right = [
    A('', 'ग्रामपंचायतीला येणे असलेल्या रकमा', null, { bold: true }),
    A('', '', null),
    A('१.', 'कर', 'A1', { tax: true }),
    A('२.', 'करेतर', 'A2'),
    A('३.', 'शासनाकडून', null),
    A('', '(क) नुकसानभरपाई अनुदान', 'A3a', { indent: 1 }),
    A('', '(ख) सहायक अनुदान', 'A3b', { indent: 1 }),
    { no: '', label: 'एकूण ३ (क) + (ख)', amount: sumOf(assets, ['A3a', 'A3b']), bold: true, right: true },
    A('४.', 'इतर जमा रकमा', 'A4'),
    A('५.', 'अग्रिम वसुली बाकी', 'A5'),
    A('६.', 'पंचायतीची स्थावर मालमत्ता', 'A6'),
    A('७.', 'रस्ता मालमत्ता', 'A7'),
    A('८.', 'जमिनीची मालमत्ता', 'A8'),
    A('९.', 'पाणीपुरवठा योजना मालमत्ता (यादी तपशीलाशी जोडावी)', 'A9'),
    { no: '', label: 'एकूण १ ते ९', amount: assetsTotal, bold: true, right: true },
  ];
  const rowsCount = Math.max(left.length, right.length);

  function cells(r, split) {
    const adj = r && r.tax ? (assets.find((i) => i.code === 'A1') || {}).adjustment : null;
    return [
      <td key="n" className={split ? 'an-split' : ''} style={{ fontWeight: r && r.bold ? 700 : 400 }}>{r ? r.no : ''}</td>,
      <td key="l" className="an-name" style={{ paddingLeft: 6 + (r && r.indent ? 14 : 0), fontWeight: r && r.bold ? 700 : 400, textAlign: r && r.right ? 'right' : 'left' }}>
        {r ? r.label : ''}
        {adj && (adj.discount > 0 || adj.penalty > 0) && <div style={{ fontSize: 11, fontWeight: 400 }}>(सूट ₹{adj.discount.toFixed(2)} वजा, दंड ₹{adj.penalty.toFixed(2)} समाविष्ट)</div>}
      </td>,
      <td key="a" className="num" style={{ fontWeight: r && r.bold ? 700 : 400 }}>{r && r.amount !== null ? fmt(r.amount) : ''}</td>,
    ];
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

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="annual-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17 }}>नमुना ४</div>
          <div style={{ textAlign: 'center', fontSize: 13 }}>(नियम २६(१) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, margin: '2px 0' }}>पंचायतीचे भत्ते व दायित्वे</div>
          <div style={{ textAlign: 'center', fontSize: 13, margin: '4px 0 8px' }}>
            ग्रामपंचायत {gpName ? <strong>{gpName}</strong> : '-------------'}, पंचायत समिती {settings?.taluka ? <strong>{settings.taluka}</strong> : '---------'}, जिल्हा {settings?.district ? <strong>{settings.district}</strong> : '-------------'}
            {currentYear ? <span> (सन {currentYear.year_label})</span> : null}
          </div>
          <table className="an-table">
            <colgroup>
              <col style={{ width: '6%' }} /><col style={{ width: '31%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '6%' }} /><col style={{ width: '31%' }} /><col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr><th>अ. क्र.</th><th>दायित्वे</th><th>रक्कम</th><th className="an-split">अ. क्र.</th><th>भत्ता</th><th>रक्कम</th></tr>
              <tr className="an-numrow"><th>(१)</th><th>(२)</th><th>(३)</th><th className="an-split">(१)</th><th>(२)</th><th>(३)</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: rowsCount }, (_, i) => (
                <tr key={i}>{cells(left[i], false)}{cells(right[i], true)}</tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 13 }}>निव्वळ (भत्ता - दायित्वे): <strong>{fmt(assetsTotal - liabilitiesTotal)}</strong></div>
        </div>
      )}
    </div>
  );
}
