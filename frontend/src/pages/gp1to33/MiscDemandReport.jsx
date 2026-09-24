import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

const fmt = (n) => Number(n || 0).toFixed(2);

// नमुना ११ - किरकोळ मागणी नोंदवही (प्रिंट). डाटाएंट्री MiscDemandEntry.jsx वर.
export default function MiscDemandReport() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!yearId) return;
    client.get('/misc-demands', { params: { financialYearId: yearId } }).then(({ data }) => setRows([...data].reverse()));
  }, [yearId]);

  const tot = (k) => rows.reduce((s, r) => s + Number(r[k]), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>किरकोळ मागणी अहवाल (नमुना ११) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_misc_demands', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>
      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>सन {currentYear?.year_label || ''} या वर्षासाठी किरकोळ मागणी नोंदवही (नमुना ११)</p>
      </div>
      <div className="table-wrap">
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>अ.क्र.</th><th>नाव व पत्ता</th><th>स्वरूप</th><th>प्राधिकार</th><th className="num">हप्ते</th><th className="num">मागणी रक्कम</th>
              <th>देयक क्र./दिनांक</th><th>वसुली (पावती क्र./दि./रक्कम)</th><th>सूट (आदेश/रक्कम)</th><th className="num">शिल्लक</th><th>शेरा</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id}>
                <td>{i + 1}</td><td>{d.party_name}{d.address ? `, ${d.address}` : ''}</td><td>{d.nature || '-'}</td><td>{d.authority || '-'}</td>
                <td className="num">{d.installment_count}</td><td className="num">{fmt(d.amount)}</td><td>{d.demand_no || '-'} {d.demand_date || ''}</td>
                <td>{d.events.filter((e) => e.kind === 'वसुली').map((e) => <div key={e.id}>{e.receipt_no || '-'} / {e.event_date} / {fmt(e.amount)}</div>)}</td>
                <td>{d.events.filter((e) => e.kind === 'सूट').map((e) => <div key={e.id}>{e.order_no || '-'} / {fmt(e.amount)}</div>)}</td>
                <td className="num">{fmt(d.balance)}</td><td>{d.remark || ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            {rows.length > 0 && <tr><td colSpan={5} style={{ textAlign: 'right' }}><strong>एकूण</strong></td><td className="num"><strong>{fmt(tot('amount'))}</strong></td><td /><td className="num"><strong>{fmt(tot('recovered_total'))}</strong></td><td className="num"><strong>{fmt(tot('waived_total'))}</strong></td><td className="num"><strong>{fmt(tot('balance'))}</strong></td><td /></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16, fontSize: 13 }}>टीप - शेरे व दुरुस्त्या सरपंचाने अनुप्रमाणित कराव्यात.</p>
    </div>
  );
}
