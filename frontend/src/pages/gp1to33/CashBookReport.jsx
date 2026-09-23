import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// नमुना ५ - दैनिक रोकड वही अहवाल (कालावधीसाठी जमा व खर्च दोन्ही स्वतंत्र
// तक्त्यांत, चढती बेरीज (शिल्लक) सह).
export default function CashBookReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/cash-book', { params: { financialYearId: yearId, from, to } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const jamaRows = rows.filter((r) => r.entry_type === 'जमा');
  const kharchRows = rows.filter((r) => r.entry_type === 'खर्च');
  const jamaTotal = jamaRows.reduce((s, r) => s + Number(r.amount), 0);
  const kharchTotal = kharchRows.reduce((s, r) => s + Number(r.amount), 0);

  function EntryTable({ title, list, total }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>दिनांक</th><th>लेखाशीर्ष</th><th>संदर्भ</th><th>मोड</th><th>नोंद</th><th className="num">रक्कम</th></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.entry_date?.slice(0, 10)}</td>
                  <td>{r.head_code} - {r.head_name}</td>
                  <td>{r.reference_no || '-'}</td>
                  <td>{r.payment_mode}</td>
                  <td>{r.narration || '-'}</td>
                  <td className="num">{Number(r.amount).toFixed(2)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr className="total-row"><td colSpan={5}>एकूण</td><td className="num">{total.toFixed(2)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>रोकड वही अहवाल (नमुना ५)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn secondary" type="button" onClick={load}>दाखवा</button>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_cash_book', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>दैनिक रोकड वही (नमुना ५)</p>
        <p>आर्थिक वर्ष: {currentYear?.year_label || ''} | कालावधी: {from} ते {to}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <EntryTable title="जमा" list={jamaRows} total={jamaTotal} />
          <EntryTable title="खर्च" list={kharchRows} total={kharchTotal} />
          <div className="card" style={{ maxWidth: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>एकूण जमा</span><strong>{jamaTotal.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>एकूण खर्च</span><strong>{kharchTotal.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <span>निव्वळ (जमा - खर्च)</span><strong>{(jamaTotal - kharchTotal).toFixed(2)}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
