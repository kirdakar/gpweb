import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import { fmtDate } from '../../utils/formatDate';

// रिपोर्ट मेन्यूतील यादी: नमुना १२ (आकस्मिक खर्चाचे प्रमाणक) = रोकड वहीतील खर्च नोंदी,
// नमुना ७ (सामान्य पावती) = जमा नोंदी - प्रत्येक नोंदीसमोर "प्रिंट" (वेगळी नोंद पुन्हा भरावी लागत नाही).
const KINDS = {
  voucher: { title: 'आकस्मिक खर्चाचे प्रमाणक (नमुना १२)', entryType: 'खर्च', path: 'voucher', btn: 'प्रमाणक छापा', hint: 'रोकड वहीतील खर्च नोंदी - प्रमाणक छापण्यासाठी नोंदीसमोरील बटण दाबा.' },
  receipt: { title: 'सामान्य पावती (नमुना ७)', entryType: 'जमा', path: 'receipt', btn: 'पावती छापा', hint: 'रोकड वहीतील जमा नोंदी - पावती छापण्यासाठी नोंदीसमोरील बटण दाबा.' },
};

export default function CashBookDocList({ kind }) {
  const cfg = KINDS[kind];
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [register, setRegister] = useState('मुख्य');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/cash-book', { params: { financialYearId: yearId, entryType: cfg.entryType, register } })
      .then(({ data }) => setRows([...data].reverse()))
      .finally(() => setLoading(false));
  }, [yearId, register, cfg.entryType]);

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => [r.reference_no, r.head_name, r.head_code, r.narration, fmtDate(r.entry_date), r.amount].join(' ').toLowerCase().includes(t));
  }, [rows, search]);

  return (
    <div className="page data-entry-page">
      <div className="page-header">
        <h1>{cfg.title} {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <CloseReportButton />
      </div>
      <p style={{ color: 'var(--text-muted)' }}>{cfg.hint}</p>
      <div className="search-bar" style={{ alignItems: 'center' }}>
        <input placeholder="क्रमांक, शीर्ष, तपशील, तारीख किंवा रकमेनुसार शोधा" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={register} onChange={(e) => setRegister(e.target.value)}>
          <option value="मुख्य">मुख्य रोकडवही (नमुना ५)</option>
          <option value="किरकोळ">किरकोळ रोकडवही (नमुना १८)</option>
        </select>
      </div>
      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>दिनांक</th><th>संदर्भ क्र.</th><th>लेखाशीर्ष</th><th>तपशील</th><th className="num">रक्कम</th><th></th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.entry_date)}</td>
                  <td>{r.reference_no || '-'}</td>
                  <td className="col-wrap">{r.head_code} - {r.head_name}</td>
                  <td className="col-wrap">{r.narration || '-'}</td>
                  <td className="num">{Number(r.amount).toFixed(2)}</td>
                  <td>{can('reports_receipt_voucher', 'print') && <Link className="btn secondary small" to={`/gp1to33/reports/${cfg.path}/${r.id}`}>{cfg.btn}</Link>}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
