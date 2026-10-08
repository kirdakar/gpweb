import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const cell = (n) => (Number(n) ? Number(n).toFixed(2) : '');
const PER_PAGE = 4;
const W1 = [4, 24, 13, 13, 9, 9, 15, 13];
const W2 = [3, 10, 8, 12, 8, 12, 8, 12, 14, 13];

// नमुना २३ (नियम ६८ पाहा) - ताब्यातील रस्त्यांची नोंदवही, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते (१: अनुक्रमांक, रस्त्याचे नाव,
// गाव पासून/पर्यंत, लांबी, रुंदी (किलोमीटर), प्रकार, पूर्ण केल्याची तारीख; २: प्रति किलोमीटर रस्ता तयार करण्यास आलेला खर्च, दुरुस्त्या -
// चालू/विशेष/मूळ बांधकाम (खर्च व स्वरूप), शेरा, पडताळणीच्या सह्या). डाटाएंट्री RoadAssetEntry.jsx वर; प्रति किलोमीटर खर्च = एकूण खर्च ÷ लांबी.
export default function RoadAssetsReport() {
  const { currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/fixed-assets', { params: { category: 'रस्ते' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += PER_PAGE) out.push(rows.slice(i, i + PER_PAGE));
    return out;
  }, [rows]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>ताब्यातील रस्ते अहवाल (नमुना २३)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_fixed_assets', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>अद्याप नोंद नाही.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २३</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम ६८ पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>ताब्यातील रस्त्यांची नोंदवही</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>
            ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; गट : {settings?.taluka ? <strong>{settings.taluka}</strong> : '----------'} &nbsp; जिल्हा : {settings?.district ? <strong>{settings.district}</strong> : '----------'}
            &nbsp; (सन {currentYear?.year_label})
          </div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>अनुक्रमांक</th><th rowSpan={2}>रस्त्याचे नाव</th><th colSpan={2}>गाव</th>
                <th rowSpan={2}>लांबी (किलोमीटर)</th><th rowSpan={2}>रुंदी (किलोमीटर)</th>
                <th rowSpan={2}>रस्त्याचा प्रकार (खडीचा, बिनखडीचा, डांबरी किंवा सिमेंटचा)</th><th rowSpan={2}>पूर्ण केल्याची तारीख</th>
              </tr>
              <tr><th>पासून</th><th>पर्यंत</th></tr>
              <tr className="cl-numrow">{Array.from({ length: 8 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td className="num">{mnum(pi * PER_PAGE + i + 1)}</td>
                  <td className="cl-name">{r.description}</td><td className="cl-name">{r.from_place || ''}</td><td className="cl-name">{r.to_place || ''}</td>
                  <td className="num">{r.length_km != null ? Number(r.length_km) : ''}</td>
                  <td className="num">{r.width_km != null ? Number(r.width_km) : ''}</td>
                  <td className="cl-name">{r.road_type || ''}</td>
                  <td>{r.acquired_date ? fmtDate(r.acquired_date) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={3}>अनुक्रमांक</th>
                <th rowSpan={3}>प्रति किलोमीटर रस्ता तयार करण्यास आलेला खर्च</th>
                <th colSpan={6}>दुरुस्त्या</th>
                <th rowSpan={3}>शेरा</th>
                <th rowSpan={3}>मालमत्तेची पडताळणी केल्याचे दर्शक म्हणून सरपंच व सचिव यांच्या सह्या</th>
              </tr>
              <tr><th colSpan={2}>चालू</th><th colSpan={2}>विशेष</th><th colSpan={2}>मूळ बांधकाम</th></tr>
              <tr><th>खर्च</th><th>स्वरूप</th><th>खर्च</th><th>स्वरूप</th><th>खर्च</th><th>स्वरूप</th></tr>
              <tr className="cl-numrow">
                <th />{['९', '१०-क', '१०-ख', '१०-ग', '१०-घ', '१०-ङ', '१०-च', '११', '१२'].map((n) => <th key={n}>({n.replace(/\d+/, (d) => mnum(d))})</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((r, ri) => {
                const lines = Math.max(r.expenses.length, 1);
                const perKm = Number(r.length_km) > 0 ? Number(r.cost_amount) / Number(r.length_km) : null;
                const trs = [];
                for (let i = 0; i < lines; i += 1) {
                  const x = r.expenses[i];
                  trs.push(
                    <tr key={`${r.id}-${i}`}>
                      {i === 0 && <td rowSpan={lines} className="num">{mnum(pi * PER_PAGE + ri + 1)}</td>}
                      {i === 0 && <td rowSpan={lines} className="num">{perKm != null ? fmt(perKm) : ''}</td>}
                      <td className="num">{x ? cell(x.current_repairs) : ''}</td><td className="cl-name">{x ? (x.current_nature || '') : ''}</td>
                      <td className="num">{x ? cell(x.special_repairs) : ''}</td><td className="cl-name">{x ? (x.special_nature || '') : ''}</td>
                      <td className="num">{x ? cell(x.original_construction) : ''}</td><td className="cl-name">{x ? (x.original_nature || x.work_nature || '') : ''}</td>
                      {i === 0 && <td rowSpan={lines} className="cl-name">{r.remark || ''}</td>}
                      {i === 0 && <td rowSpan={lines} />}
                    </tr>
                  );
                }
                return trs;
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
