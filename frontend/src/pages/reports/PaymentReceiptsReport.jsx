import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { fmtDate } from '../../utils/formatDate';

// घरपट्टी व पाणीपट्टी आता दोन स्वतंत्र पावती-मालिका (receipt_type) असल्याने
// (पहा PaymentEntry.jsx) हा अहवालही दोन स्वतंत्र तक्त्यांत दाखवतो - एका
// तक्त्यात दुसऱ्या गटाचे रिकामे स्तंभ भरत बसण्यापेक्षा प्रत्येक गटाला
// लागू असलेलेच स्तंभ दाखवणे स्पष्ट आहे.
const GROUP_COMPONENTS = {
  gharpatti: [
    { key: 'gharpatti', label: 'घरपट्टी' },
    { key: 'divabatti', label: 'दिवाबत्ती' },
    { key: 'arogya', label: 'आरोग्य कर' },
  ],
  panipatti: [
    { key: 'panipatti', label: 'पाणी पट्टी' },
  ],
};
const EXTRA_FIELDS = {
  gharpatti: [
    { key: 'khuli_jaga_amount', label: 'खुली जागा कर' },
    { key: 'notice_fee_amount', label: 'नोटीस फी' },
    { key: 'warrant_fee_amount', label: 'वारंट फी' },
  ],
  panipatti: [
    { key: 'notice_fee_amount', label: 'नोटीस फी' },
    { key: 'other_amount', label: 'इतर' },
  ],
};
const RECEIPT_LABELS = { gharpatti: 'घरपट्टी पावती अहवाल', panipatti: 'पाणीपट्टी पावती अहवाल' };

function groupSum(row, prefix, components) {
  return components.reduce((s, c) => s + Number(row[`${prefix}_${c.key}`] || 0), 0);
}

function ReceiptTypeTable({ type, rows }) {
  const components = GROUP_COMPONENTS[type];
  const extraFields = EXTRA_FIELDS[type];
  if (rows.length === 0) return null;

  const totals = rows.reduce((acc, r) => {
    acc.amount += Number(r.amount || 0);
    acc.previous_total += groupSum(r, 'previous', components);
    acc.current_total += groupSum(r, 'current', components);
    acc.extras_total += Number(r.extra_charges_total || 0);
    for (const f of extraFields) acc[f.key] = (acc[f.key] || 0) + Number(r[f.key] || 0);
    return acc;
  }, { amount: 0, previous_total: 0, current_total: 0, extras_total: 0 });

  return (
    <div style={{ marginBottom: 30 }}>
      <h3 style={{ marginBottom: 8 }}>{RECEIPT_LABELS[type]}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>पावती क्र.</th>
              <th rowSpan={2}>दिनांक</th>
              <th rowSpan={2}>मालकाचे नाव</th>
              <th rowSpan={2}>मालमत्ता क्र.</th>
              <th rowSpan={2} className="num">कर जमा</th>
              <th colSpan={components.length + 1}>मागील बाकीतून वसूल</th>
              <th colSpan={components.length + 1}>चालू वर्षातून वसूल</th>
              {extraFields.map((f) => <th key={f.key} rowSpan={2} className="num">{f.label}</th>)}
              <th rowSpan={2} className="num">एकूण जमा</th>
              <th colSpan={components.length + 1}>येणे बाकी (पावतीनंतर)</th>
            </tr>
            <tr>
              {components.map((c) => <th key={`p-${c.key}`} className="num">{c.label}</th>)}
              <th className="num">एकूण</th>
              {components.map((c) => <th key={`c-${c.key}`} className="num">{c.label}</th>)}
              <th className="num">एकूण</th>
              {components.map((c) => <th key={`r-${c.key}`} className="num">{c.label}</th>)}
              <th className="num">एकूण</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.receipt_no}</td>
                <td>{fmtDate(r.payment_date)}</td>
                <td>{r.owner_name}</td>
                <td>{r.malmata_no ?? '-'}</td>
                <td className="num">{Number(r.amount).toFixed(2)}</td>
                {components.map((c) => <td key={`p-${c.key}`} className="num">{Number(r[`previous_${c.key}`] || 0).toFixed(2)}</td>)}
                <td className="num" style={{ fontWeight: 600 }}>{groupSum(r, 'previous', components).toFixed(2)}</td>
                {components.map((c) => <td key={`c-${c.key}`} className="num">{Number(r[`current_${c.key}`] || 0).toFixed(2)}</td>)}
                <td className="num" style={{ fontWeight: 600 }}>{groupSum(r, 'current', components).toFixed(2)}</td>
                {extraFields.map((f) => <td key={f.key} className="num">{Number(r[f.key] || 0).toFixed(2)}</td>)}
                <td className="num" style={{ fontWeight: 600 }}>{(Number(r.amount) + Number(r.extra_charges_total || 0)).toFixed(2)}</td>
                {components.map((c) => <td key={`r-${c.key}`} className="num" style={{ color: 'var(--text-muted)' }}>{Number(r[`remaining_${c.key}`] || 0).toFixed(2)}</td>)}
                <td className="num" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{groupSum(r, 'remaining', components).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={4}>एकूण</td>
              <td className="num">{totals.amount.toFixed(2)}</td>
              {components.map((c) => <td key={`tp-${c.key}`} className="num"></td>)}
              <td className="num">{totals.previous_total.toFixed(2)}</td>
              {components.map((c) => <td key={`tc-${c.key}`} className="num"></td>)}
              <td className="num">{totals.current_total.toFixed(2)}</td>
              {extraFields.map((f) => <td key={f.key} className="num">{(totals[f.key] || 0).toFixed(2)}</td>)}
              <td className="num">{(totals.amount + totals.extras_total).toFixed(2)}</td>
              {components.map((c) => <td key={`tr-${c.key}`} className="num">-</td>)}
              <td className="num">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function PaymentReceiptsReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/payment-receipts', { params: { yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const yearLabel = years.find((y) => y.id === yearId)?.year_label || '';
  const gharpattiRows = rows.filter((r) => r.receipt_type === 'gharpatti');
  const panipattiRows = rows.filter((r) => r.receipt_type === 'panipatti');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>जमा पावती अहवाल</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_payment_receipts', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>{gpLine}</h2>
        <p style={{ fontWeight: 700 }}>जमा पावती अहवाल</p>
        <p>आर्थिक वर्ष: {yearLabel}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <ReceiptTypeTable type="gharpatti" rows={gharpattiRows} />
          <ReceiptTypeTable type="panipatti" rows={panipattiRows} />
          {rows.length === 0 && <p style={{ textAlign: 'center' }}>या वर्षात कोणतीही जमा नोंद नाही</p>}
        </>
      )}
    </div>
  );
}
