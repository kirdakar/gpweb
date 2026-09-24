import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना १९ - कामावरील हजेरीपट (प्रिंट, 31 दिवसांच्या ग्रीडसह). डाटाएंट्री
// MusterEntry.jsx (दैनिक व्यवहार) वर.
export default function MusterReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rolls, setRolls] = useState([]);
  const [rollId, setRollId] = useState('');
  const [roll, setRoll] = useState(null);

  useEffect(() => {
    if (!yearId) return;
    setRollId(''); setRoll(null);
    client.get('/muster-rolls', { params: { financialYearId: yearId } }).then(({ data }) => setRolls(data));
  }, [yearId]);
  useEffect(() => {
    if (!rollId) { setRoll(null); return; }
    client.get(`/muster-rolls/${rollId}`).then(({ data }) => setRoll(data));
  }, [rollId]);

  const days = roll ? new Date(roll.year, roll.month, 0).getDate() : 31;

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>हजेरीपट अहवाल (नमुना १९) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!roll || !can('reports_muster_roll', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={rollId} onChange={(e) => setRollId(e.target.value)} style={{ minWidth: 340 }}>
            <option value="">-- हजेरीपट निवडा --</option>
            {rolls.map((r) => <option key={r.id} value={r.id}>{MONTHS[r.month - 1]} {r.year} - {r.work_name || r.title || 'हजेरीपट'}</option>)}
          </select>
        </div>
      </div>

      {roll && (
        <>
          <div className="print-header">
            <h2>{gpLine}</h2>
            <p style={{ fontWeight: 700 }}>कामावरील हजेरीपट (नमुना १९)</p>
            <p>{roll.work_name ? `काम: ${roll.work_name} | ` : ''}महिना: {MONTHS[roll.month - 1]} {roll.year}{roll.title ? ` | ${roll.title}` : ''}</p>
          </div>
          <div className="table-wrap">
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>अ.क्र.</th><th>नाव</th><th>पत्ता</th>
                  {Array.from({ length: days }, (_, d) => <th key={d} style={{ padding: '2px 3px' }}>{d + 1}</th>)}
                  <th className="num">दिवस</th><th className="num">दर</th><th className="num">मजुरी</th><th className="num">दंड</th><th className="num">निव्वळ</th><th>सही</th>
                </tr>
              </thead>
              <tbody>
                {roll.workers.map((w, i) => (
                  <tr key={w.id}>
                    <td>{i + 1}</td><td>{w.name}{w.post ? ` (${w.post})` : ''}</td><td>{w.address || '-'}</td>
                    {Array.from({ length: days }, (_, d) => <td key={d} style={{ padding: '2px 3px', textAlign: 'center' }}>{w.attendance[d] === 'P' ? 'P' : ''}</td>)}
                    <td className="num">{w.days}</td><td className="num">{fmt(w.rate_per_day)}</td><td className="num">{fmt(w.gross_wage)}</td>
                    <td className="num">{fmt(w.fine)}</td><td className="num">{fmt(w.net_wage)}</td><td style={{ minWidth: 60 }}></td>
                  </tr>
                ))}
                <tr><td colSpan={3 + days + 4} style={{ textAlign: 'right' }}><strong>एकूण देय मजुरी</strong></td><td className="num"><strong>{fmt(roll.total_wages)}</strong></td><td /></tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
            <span>हजेरी घेणारा</span><span>सचिव</span><span>सरपंच</span>
          </div>
        </>
      )}
    </div>
  );
}
