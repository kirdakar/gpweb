import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना १४ - मुद्रांक हिशोब नोंदवही (प्रिंट). डाटाएंट्री StampEntry.jsx वर.
export default function StampReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!yearId) return;
    client.get('/stamps', { params: { financialYearId: yearId } }).then(({ data }) => setRows(data));
  }, [yearId]);

  const rec = rows.filter((r) => r.kind === 'मिळाले').reduce((s, r) => s + Number(r.amount), 0);
  const used = rows.filter((r) => r.kind === 'वापरले').reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मुद्रांक हिशोब अहवाल (नमुना १४) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_stamps', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>
      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>वर्ष {currentYear?.year_label || ''} चा मुद्रांक हिशोब (नमुना १४)</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th rowSpan={2}>दिनांक</th><th colSpan={2}>मिळालेले मुद्रांक</th><th colSpan={2}>वापरलेले मुद्रांक</th><th rowSpan={2} className="num">दैनिक शिल्लक</th><th rowSpan={2}>सचिवांची सही</th><th rowSpan={2}>शेरा</th></tr>
            <tr><th>प्रमाणक क्र.</th><th className="num">किंमत</th><th>पत्र/पावती क्र. व दि.</th><th className="num">किंमत</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.entry_date}</td>
                <td>{r.kind === 'मिळाले' ? (r.ref_no || '-') : ''}</td><td className="num">{r.kind === 'मिळाले' ? fmt(r.amount) : ''}</td>
                <td>{r.kind === 'वापरले' ? `${r.ref_no || '-'} ${r.ref_date || ''}` : ''}</td><td className="num">{r.kind === 'वापरले' ? fmt(r.amount) : ''}</td>
                <td className="num">{fmt(r.balance)}</td><td style={{ minWidth: 70 }}></td><td>{r.remark || ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            {rows.length > 0 && <tr><td><strong>एकूण</strong></td><td /><td className="num"><strong>{fmt(rec)}</strong></td><td /><td className="num"><strong>{fmt(used)}</strong></td><td className="num"><strong>{fmt(rows[rows.length - 1].balance)}</strong></td><td /><td /></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16, fontSize: 13 }}>टीप - आपल्याजवळ शिल्लक असलेले मुद्रांक सरपंच किंवा अन्य जबाबदार अधिकाऱ्याने महिन्यातून किमान एकदा पडताळून पाहिले पाहिजेत आणि प्रमाणित केले पाहिजेत.</p>
    </div>
  );
}
