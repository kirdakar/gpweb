import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => Number(n || 0).toFixed(2);
const cell = (n) => (Number(n) ? Number(n).toFixed(2) : '');
const PER_PAGE = 3;
const W1 = [3, 8, 11, 12, 9, 8, 9, 8, 8, 8, 16];
const W2 = [3, 14, 12, 21, 26, 24];
// घसाऱ्याचे दर (वर्षाला मूळ किमतीच्या टक्के) - नमुना २२ च्या टिपेतील तक्त्यानुसार; वर्ग ४ चा दर विहित नाही.
const RATE = { 1: 2.5, 2: 5.0, 3: 7.5 };

// वर्षाचा शेवट - आर्थिक वर्ष "2025-2026" -> 2026-03-31
function fyEnd(label) {
  const m = /(\d{4})\D+(\d{4})/.exec(label || '');
  return m ? `${m[2]}-03-31` : null;
}
function yearsBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(`${String(from).slice(0, 10)}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const y = Math.floor((b - a) / (365.25 * 24 * 3600 * 1000));
  return y < 0 ? 0 : y;
}

// नमुना २२ (नियम ५७(१) पाहा) - स्थावर मालमत्ता नोंदवही (रस्ते व जमिनीव्यतिरिक्त), कागदी नमुन्याप्रमाणे A4 आडव्या पानावर दोन तक्ते
// (१: अ.क्र. ते रकाना ११ - खरेदी/आदेश/भूखंड/वापर/खर्च व वर्षभरातील दुरुस्ती-फेरफार खर्च; २: वर्ष अखेरीस घटलेली किंमत, आद्याक्षरी,
// विल्हेवाटीचा ठराव/आदेश, शेरा) व शेवटी घसाऱ्याच्या दरांची टीप. डाटाएंट्री ImmovableAssetEntry.jsx वर. घटलेली किंमत =
// खर्च × (१ - दर% × वर्ग-दराने आर्थिक वर्षाअखेरपर्यंत पूर्ण झालेली वर्षे), शून्याखाली नाही; वर्ग/दर नसेल तर रिकामी.
export default function ImmovableAssetsReport() {
  const { currentYear } = useYear();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/fixed-assets', { params: { category: 'स्थावर' } }).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);

  const end = fyEnd(currentYear?.year_label);
  const data = useMemo(() => rows.map((r) => {
    const rate = RATE[r.asset_class];
    // जुन्या नोंदींमध्ये अवैध शून्य तारीख (0000-00-00) असू शकते - ती रिकामी समजतो
    const acq = toDateInput(r.acquired_date);
    const disp = toDateInput(r.disposal_date);
    const disposed = disp && end && disp <= end;
    let reduced = null;
    if (disposed) reduced = 0;
    else if (rate && acq) {
      const yrs = yearsBetween(acq, end);
      if (yrs != null) reduced = Math.max(0, Number(r.cost_amount) * (1 - (rate / 100) * yrs));
    }
    return { ...r, reduced };
  }), [rows, end]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < data.length; i += PER_PAGE) out.push(data.slice(i, i + PER_PAGE));
    return out;
  }, [data]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>स्थावर मालमत्ता अहवाल (नमुना २२)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_fixed_assets', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading && <p>लोड होत आहे...</p>}
      {!loading && rows.length === 0 && <p>अद्याप नोंद नाही.</p>}

      {!loading && pages.map((list, pi) => (
        <div key={pi} className="a4-page cl-page">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना २२</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम ५७ (१) पाहा)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, margin: '2px 0' }}>स्थावर मालमत्ता नोंदवही (रस्ते व जमिनीव्यतिरिक्त)</div>
          <div style={{ fontSize: 12, margin: '2px 0 6px' }}>ग्रामपंचायत : {gpName ? <strong>{gpName}</strong> : '.........................'} &nbsp; (सन {currentYear?.year_label})</div>

          <table className="cl-table">
            <colgroup>{W1.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>अ. क्र.</th>
                <th rowSpan={2}>संपादनाची किंवा खरेदीची किंवा उभारणीची तारीख</th>
                <th rowSpan={2}>ज्याअन्वये मालमत्ता संपादित केली त्या आदेशाचे व पंचायत ठरावाचे क्रमांक व दिनांक</th>
                <th rowSpan={2}>मालमत्तेचा भूखंड/ भूमापन क्रमांक व मालमत्तेचे वर्णन</th>
                <th rowSpan={2}>कोणत्या कारणासाठी वापर केला</th>
                <th rowSpan={2}>उभारणीचा किंवा संपादनाचा खर्च</th>
                <th colSpan={5}>दुरुस्त्यांवर किंवा फेरफारावर वर्षभरात खर्च करण्यात आलेली रक्कम</th>
              </tr>
              <tr><th>तारीख</th><th>चालू दुरुस्त्या</th><th>विशेष दुरुस्त्या</th><th>मूळ बांधकाम</th><th>मूळ बांधकामाचे कामाचे स्वरूप</th></tr>
              <tr className="cl-numrow">{Array.from({ length: 11 }, (_, i) => <th key={i}>({mnum(i + 1)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((a, ai) => {
                const lines = Math.max(a.expenses.length, 1);
                const trs = [];
                for (let i = 0; i < lines; i += 1) {
                  const x = a.expenses[i];
                  trs.push(
                    <tr key={`${a.id}-${i}`}>
                      {i === 0 && <td rowSpan={lines} className="num">{mnum(pi * PER_PAGE + ai + 1)}</td>}
                      {i === 0 && <td rowSpan={lines}>{a.acquired_date ? fmtDate(a.acquired_date) : ''}</td>}
                      {i === 0 && <td rowSpan={lines} className="cl-name">{a.acquired_mode || ''}</td>}
                      {i === 0 && <td rowSpan={lines} className="cl-name">{[a.survey_no, a.description].filter(Boolean).join(' - ')}</td>}
                      {i === 0 && <td rowSpan={lines} className="cl-name">{a.purpose || ''}</td>}
                      {i === 0 && <td rowSpan={lines} className="num">{fmt(a.cost_amount)}</td>}
                      <td>{x ? fmtDate(x.expense_date) : ''}</td>
                      <td className="num">{x ? cell(x.current_repairs) : ''}</td>
                      <td className="num">{x ? cell(x.special_repairs) : ''}</td>
                      <td className="num">{x ? cell(x.original_construction) : ''}</td>
                      <td className="cl-name">{x ? (x.work_nature || '') : ''}</td>
                    </tr>
                  );
                }
                return trs;
              })}
            </tbody>
          </table>

          <table className="cl-table" style={{ marginTop: 8 }}>
            <colgroup>{W2.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th>अ. क्र.</th>
                <th>वर्ष अखेरीस घटलेली किंमत</th>
                <th>सरपंच व सचिव यांची आद्याक्षरी</th>
                <th>मालमत्तेची विल्हेवाट लावण्यासाठी पंचायतीच्या ठरावाचा क्रमांक</th>
                <th>मालमत्तेची विल्हेवाट लावण्यासाठी कलम ५५ खालील प्राधिकाऱ्याच्या आदेशाचा क्रमांक व तारीख</th>
                <th>शेरा</th>
              </tr>
              <tr className="cl-numrow"><th />{[12, 13, 14, 15, 16].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
            </thead>
            <tbody>
              {list.map((a, ai) => (
                <tr key={a.id}>
                  <td className="num">{mnum(pi * PER_PAGE + ai + 1)}</td>
                  <td className="num">{a.reduced == null ? '' : fmt(a.reduced)}</td>
                  <td />
                  <td className="cl-name">{a.disposal_details || ''}</td>
                  <td className="cl-name">{[a.disposal_authority, a.disposal_date ? fmtDate(a.disposal_date) : ''].filter(Boolean).join(' / ')}</td>
                  <td className="cl-name">{a.remark || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pi === pages.length - 1 && (
            <div style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
              <div>टीप.- *मालमत्तेच्या एकूण वार्षिक रकमेचा हिशेब खालील आधारावर करण्यात येईल :-</div>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                <div>
                  <strong>मालमत्तेचा वर्ग — दर (ज्याच्या आधारे मूळ किमतीवर हिशेब करावयाचा ती संख्या)</strong>
                  <div>इमारत :- (१) निवडक सामग्री वापरलेल्या पहिल्या वर्गाच्या मजबूत इमारती — २.५</div>
                  <div>(२) कमी मजबूत बांधकामाच्या दुसऱ्या वर्गाच्या इमारती — ५.०</div>
                  <div>(३) दुसऱ्या वर्गाच्या इमारतींपेक्षा कनिष्ठ परंतु निव्वळ तात्पुरत्या उभारणी समाविष्ट नसलेल्या बांधकामाच्या तिसऱ्या वर्गाच्या इमारती — ७.५</div>
                  <div>(४) लाकडी बांधकामासारखे निव्वळ तात्पुरते इमले — --</div>
                </div>
                <div>कोणताही दर विहित केलेला नाही. महसुली खर्चाप्रमाणे नूतनीकरण अनुज्ञेय असेल.</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
