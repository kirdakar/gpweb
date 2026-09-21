import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// कोड प्रमाणे गट करून दाखवले जाते: मालकाचे नाव एकाच स्तंभात (rowSpan वापरून)
// फक्त एकदाच येते; त्याखाली त्याच मालकाच्या प्रत्येक मिळकत क्रमांक +
// बांधकाम प्रकार + कर तपशील स्वतंत्र ओळीत येतो.
function groupByCode(rows) {
  const groups = [];
  let i = 0;
  while (i < rows.length) {
    const key = rows[i].property_code ?? `__${rows[i].property_id}`;
    let j = i + 1;
    while (j < rows.length && (rows[j].property_code ?? `__${rows[j].property_id}`) === key) j++;
    groups.push(rows.slice(i, j));
    i = j;
  }
  return groups;
}

export default function PropertyListReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    client.get('/reports/property-list', { params: { yearId } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, [yearId]);

  const groups = useMemo(() => groupByCode(rows), [rows]);

  const totals = rows.reduce((acc, r) => {
    acc.gharpatti += Number(r.gharpatti || 0);
    acc.divabatti += Number(r.divabatti || 0);
    acc.arogya += Number(r.arogya || 0);
    acc.panipatti += Number(r.panipatti || 0);
    acc.total += Number(r.total_tax || 0);
    return acc;
  }, { gharpatti: 0, divabatti: 0, arogya: 0, panipatti: 0, total: 0 });

  const yearLabel = years.find((y) => y.id === yearId)?.year_label || '';

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मिळकत यादी अहवाल</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_property_list', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      <div className="print-header">
        <h2>ग्रामपंचायत मिळकत कर यादी</h2>
        <p>आर्थिक वर्ष: {yearLabel}</p>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>कोड</th><th>मालकाचे नाव</th><th>मिळकत क्रमांक</th><th>बांधकाम प्रकार</th>
                <th className="num">क्षेत्रफळ (चौ.मी.)</th><th className="num">घरपट्टी</th>
                <th className="num">दिवाबत्ती</th><th className="num">आरोग्य</th><th className="num">पाणीपट्टी</th><th className="num">एकूण</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => group.map((r, idx) => (
                <tr
                  key={r.property_id}
                  className={can('properties', 'view') ? 'row-clickable' : undefined}
                  title={can('properties', 'view') ? 'दुरूस्तीसाठी उघडण्यासाठी क्लिक करा' : undefined}
                  onClick={can('properties', 'view') ? () => navigate(`/properties/${r.property_id}`) : undefined}
                >
                  {idx === 0 && <td rowSpan={group.length}>{r.property_code ?? '-'}</td>}
                  {idx === 0 && <td rowSpan={group.length} className="col-owner">{r.owner_name}</td>}
                  <td>{r.malmata_no ?? '-'}</td>
                  <td>{r.construction_type_name || '-'}</td>
                  <td className="num">{Number(r.area_sqm || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.gharpatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.divabatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.arogya || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.panipatti || 0).toFixed(2)}</td>
                  <td className="num">{Number(r.total_tax || 0).toFixed(2)}</td>
                </tr>
              )))}
              {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={5}>एकूण</td>
                  <td className="num">{totals.gharpatti.toFixed(2)}</td>
                  <td className="num">{totals.divabatti.toFixed(2)}</td>
                  <td className="num">{totals.arogya.toFixed(2)}</td>
                  <td className="num">{totals.panipatti.toFixed(2)}</td>
                  <td className="num">{totals.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
