import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const MONTHS = [
  '१ जानेवारी', '२ फेब्रुवारी', '३ मार्च', '४ एप्रिल', '५ मे', '६ जून',
  '७ जुलै', '८ ऑगस्ट', '९ सप्टेंबर', '१० ऑक्टोबर', '११ नोव्हेंबर', '१२ डिसेंबर',
];

const FIELDS = [
  { key: 'basic_pay', label: 'वेतन' },
  { key: 'leave_pay', label: 'रजा वेतन' },
  { key: 'suspension_pay', label: 'स्थानपन वेतन' },
  { key: 'allowances', label: 'भत्ते' },
  { key: 'recovery_fine', label: 'वसुली व दंड' },
  { key: 'pf_deduction', label: 'भ.नि.नि. अंशदान' },
  { key: 'other_deductions', label: 'इतर वजाती' },
];

// नमुना २१ - कर्मचाऱ्यांच्या वेतन देयकाची नोंदणी. महिना निवडून staff_master
// (नमुना १३) मधील सक्रिय कर्मचाऱ्यांसाठी वेतन/वजाती भरतात; एकूण व निव्वळ
// रक्कम आपोआप (backend कडून) दिसते. निव्वळ रक्कम "रोकड वहीत नोंद करा" ने
// नमुना ५ मध्ये (लेखाशीर्ष K1.4) पोस्ट करता येते - रक्कम पुन्हा टाईप करायची
// गरज नाही; प्रिंट स्वरूप रिपोर्ट मेन्यूतील StaffSalaryReport.jsx वर आहे.
export default function StaffSalaryEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(null);

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/staff-salary-bills', { params: { financialYearId: yearId, year, month } })
      .then(({ data }) => { setRows(data); setEdits({}); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId, year, month]);

  function fieldValue(row, key) {
    const e = edits[row.staff_id];
    return e && e[key] !== undefined ? e[key] : row[key];
  }
  function onEdit(staffId, key, value) {
    setEdits((prev) => ({ ...prev, [staffId]: { ...prev[staffId], [key]: value } }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const entries = rows.map((r) => {
        const e = edits[r.staff_id] || {};
        const merged = {};
        for (const f of FIELDS) merged[f.key] = Number(e[f.key] !== undefined ? e[f.key] : r[f.key]) || 0;
        return { staff_id: r.staff_id, ...merged };
      });
      await client.put('/staff-salary-bills', { financial_year_id: yearId, year, month, entries });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setSaving(false);
    }
  }

  async function handlePost(staffId) {
    setError('');
    setPosting(staffId);
    try {
      await client.post(`/staff-salary-bills/${staffId}/post`, { financial_year_id: yearId, year, month });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'रोकड वहीत नोंद करताना त्रुटी आली');
    } finally {
      setPosting(null);
    }
  }

  function computeRow(row) {
    const e = {};
    for (const f of FIELDS) e[f.key] = Number(fieldValue(row, f.key)) || 0;
    const gross = e.basic_pay + e.leave_pay + e.suspension_pay + e.allowances;
    const afterRecovery = gross - e.recovery_fine;
    const totalDeductions = e.pf_deduction + e.other_deductions;
    const net = afterRecovery - totalDeductions;
    return { gross, net };
  }

  const canEdit = can('staff_salary_bills', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक वेतन देयक नोंदणी (नमुना २१) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'जतन करा'}</button>}
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>पद / कर्मचारी</th>
                {FIELDS.map((f) => <th key={f.key} className="num">{f.label}</th>)}
                <th className="num">एकूण वेतन</th>
                <th className="num">निव्वळ देय</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { gross, net } = computeRow(row);
                return (
                  <tr key={row.staff_id}>
                    <td>{row.post_name}{row.employee_name ? ` - ${row.employee_name}` : ''}</td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="num">
                        {canEdit ? (
                          <input type="number" step="0.01" value={fieldValue(row, f.key)}
                            onChange={(e) => onEdit(row.staff_id, f.key, e.target.value)}
                            style={{ width: 90, padding: 4, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
                        ) : Number(fieldValue(row, f.key)).toFixed(2)}
                      </td>
                    ))}
                    <td className="num">{gross.toFixed(2)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{net.toFixed(2)}</td>
                    <td>
                      {row.cash_book_entry_id ? (
                        <span style={{ color: 'var(--success)', fontSize: 13 }}>रोकड वहीत नोंदवले</span>
                      ) : (
                        canEdit && <button className="btn secondary small" disabled={posting === row.staff_id} onClick={() => handlePost(row.staff_id)}>
                          {posting === row.staff_id ? 'नोंदवत आहे...' : 'रोकड वहीत नोंद करा'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={FIELDS.length + 4} style={{ textAlign: 'center' }}>सक्रिय कर्मचारी नाही (नमुना १३ मध्ये नोंदवा)</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
