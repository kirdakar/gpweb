import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const fmt = (n) => Number(n || 0).toFixed(2);
const fmtDiff = (n) => `${n > 0 ? '+' : ''}${Number(n || 0).toFixed(2)}`;
const dots = (n) => '.'.repeat(n);

// नमुना २ (नियम २१ पाहा) - पुनर्विनियोजन व नियतवाटप विवरणपत्र. कागदी नमुन्याप्रमाणे A4 आडव्या (landscape) पानावर
// जमा (१-४) व खर्च (५-८) एकाच पानावर बाजू-बाजूला + शेरा (९). डाटा एंट्री BudgetRevision.jsx (दैनिक व्यवहार) वर;
// इथे फक्त छापील रूप. जमा/खर्चाचे मुख्य गट ओळीनुसार जोडीने (दोन्हीकडे सारख्याच ओळी, कमी असेल तिथे रिकामे).
export default function BudgetRevisionReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine, settings } = useGpSettings();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/budget-revisions', { params: { financialYearId: yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const jama = useMemo(() => rows.filter((r) => r.group_type === 'जमा').sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const kharch = useMemo(() => rows.filter((r) => r.group_type === 'खर्च').sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const lines = Math.max(jama.length, kharch.length);
  const pairs = Array.from({ length: lines }, (_, i) => ({ j: jama[i] || null, k: kharch[i] || null }));

  const sum = (list, key) => list.reduce((s, r) => s + Number(r[key] || 0), 0);
  const jamaTotal = { approved: sum(jama, 'approved_amount'), revised: sum(jama, 'revised_amount') };
  const kharchTotal = { approved: sum(kharch, 'approved_amount'), revised: sum(kharch, 'revised_amount') };

  const year = currentYear?.year_label || '';
  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

  const amountCells = (r) => {
    if (!r) return [<td key="a" />, <td key="b" />, <td key="c" />];
    const diff = Number(r.revised_amount) - Number(r.approved_amount);
    return [
      <td key="a" className="num">{fmt(r.approved_amount)}</td>,
      <td key="b" className="num">{fmt(r.revised_amount)}</td>,
      <td key="c" className="num">{diff === 0 ? '' : fmtDiff(diff)}</td>,
    ];
  };

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>पुनर्विनियोजन अहवाल (नमुना २) {year ? `— ${year}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={rows.length === 0 || !can('reports_budget_revision', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="a4-page budget-revision-form">
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17 }}>नमुना - २</div>
          <div style={{ textAlign: 'center', fontSize: 13 }}>(नियम २१ पाहा)</div>
          <p className="br-title">
            ग्रामपंचायतीने सन <strong>{year || dots(8)}</strong> च्या {dots(14)} महिन्यात ठराव क्रमांक {dots(12)} दिनांक {dots(14)}
            अन्वये मान्य केलेले पुनर्विनियोजन व नियतवाटप यांचे विवरणपत्र
          </p>
          <div style={{ textAlign: 'center', fontSize: 12 }}>{gpLine}</div>

          <table className="br-table">
            <colgroup>
              <col style={{ width: '19%' }} /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} />
              <col style={{ width: '19%' }} /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>जमा रकमांचे मुख्य शीर्षक</th><th>मंजूर अर्थसंकल्प</th><th>सुधारित अंदाज</th><th>अधिक (+) किंवा कमी (−)</th>
                <th>खर्चाचे प्रमुख शीर्ष</th><th>मंजूर रक्कम</th><th>खर्चाचा सुधारित अंदाज</th><th>अधिक (+) किंवा कमी (−)</th>
                <th>शेरा</th>
              </tr>
              <tr className="br-numrow">
                {['(१)', '(२)', '(३)', '(४)', '(५)', '(६)', '(७)', '(८)', '(९)'].map((n) => <th key={n}>{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, i) => (
                <tr key={i}>
                  <td className="br-name">{p.j ? p.j.name : ''}</td>
                  {amountCells(p.j)}
                  <td className="br-name">{p.k ? p.k.name : ''}</td>
                  {amountCells(p.k)}
                  {i === 0 && <td rowSpan={lines + 1} />}
                </tr>
              ))}
              <tr className="br-total">
                <td>एकूण</td>
                <td className="num">{fmt(jamaTotal.approved)}</td>
                <td className="num">{fmt(jamaTotal.revised)}</td>
                <td className="num">{fmtDiff(jamaTotal.revised - jamaTotal.approved)}</td>
                <td>एकूण</td>
                <td className="num">{fmt(kharchTotal.approved)}</td>
                <td className="num">{fmt(kharchTotal.revised)}</td>
                <td className="num">{fmtDiff(kharchTotal.revised - kharchTotal.approved)}</td>
              </tr>
            </tbody>
          </table>

          <div className="br-memo">
            <div><strong>ज्ञापन :</strong></div>
            <div>दिनांक {dots(14)} २०{dots(6)}</div>
            <div>ग्रामपंचायतीचा {gpName ? <strong>{gpName}</strong> : dots(14)} क्रमांक {dots(10)} २०{dots(6)} चा</div>
            <div>खाली सही करणारी व्यक्ती माहे {dots(14)} २०{dots(6)} चे पुनर्विनियोजन व नियतवाटप यांचे विवरणपत्र पाठवीत आहे.</div>
            <div className="br-sign">
              <div>
                सभापती,<br />पंचायत समिती {dots(14)} गट,<br />जिल्हा {settings?.district || dots(14)}<br />यांस
              </div>
              <div style={{ textAlign: 'center' }}>
                <br /><br />सरपंच<br />ग्रामपंचायत {gpName || dots(14)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
