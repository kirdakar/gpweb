import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

const MONTHS = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
];
const FIELDS = [
  { key: 'in_hand', label: 'सचिवाकडील हातची' },
  { key: 'in_bank', label: 'बँकेतील' },
  { key: 'in_post', label: 'पोस्टातील' },
  { key: 'savings_certificates', label: 'अल्पबचत प्रमाणपत्रे' },
  { key: 'fixed_deposits', label: 'बँक मुदत ठेव' },
];

// नमुना २६-ख - मासिक शिल्लक विवरण नोंदणी. प्रारंभिक/अखेरची शिल्लक रोकड वहीवरून
// (नमुना ५) आपोआप येते; फक्त ती कोठे ठेवली आहे याची विभागणी भरायची, आणि
// बेरीज रोकड वहीशी जुळत नसल्यास फरक दिसतो.
export default function BalanceStatementEntry() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (!yearId) return;
    setLoading(true);
    client.get('/balance-statements', { params: { financialYearId: yearId } })
      .then(({ data }) => { setRows(data); setEdits({}); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [yearId]);

  const keyOf = (r) => `${r.year}-${r.month}`;
  const val = (r, k) => (edits[keyOf(r)]?.[k] !== undefined ? edits[keyOf(r)][k] : r[k]);
  function onEdit(r, k, v) { setEdits((p) => ({ ...p, [keyOf(r)]: { ...p[keyOf(r)], [k]: v } })); }

  function diffOf(r) {
    const total = FIELDS.reduce((s, f) => s + (Number(val(r, f.key)) || 0), 0);
    return Math.round((total - r.closing) * 100) / 100;
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const entries = Object.keys(edits).map((key) => {
        const r = rows.find((x) => keyOf(x) === key);
        const e = { year: r.year, month: r.month, remark: val(r, 'remark') };
        for (const f of FIELDS) e[f.key] = Number(val(r, f.key)) || 0;
        return e;
      });
      if (entries.length === 0) return;
      await client.put('/balance-statements', { financial_year_id: yearId, entries });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'जतन करताना त्रुटी आली');
    } finally {
      setSaving(false);
    }
  }

  const canEdit = can('balance_statements', 'edit');

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>मासिक शिल्लक विवरण नोंदणी (नमुना २६-ख) {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'जतन होत आहे...' : 'जतन करा'}</button>}
          <CloseReportButton />
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {loading ? <p>लोड होत आहे...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>महिना</th><th className="num">प्रारंभिक शिल्लक</th>
                {FIELDS.map((f) => <th key={f.key} className="num">{f.label}</th>)}
                <th className="num">अखेरची शिल्लक (रोकड वही)</th><th className="num">फरक</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = diffOf(r);
                return (
                  <tr key={keyOf(r)}>
                    <td>{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="num">{r.opening.toFixed(2)}</td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="num">
                        {canEdit ? (
                          <input type="number" step="0.01" value={val(r, f.key)} onChange={(e) => onEdit(r, f.key, e.target.value)}
                            style={{ width: 100, padding: 4, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
                        ) : Number(val(r, f.key)).toFixed(2)}
                      </td>
                    ))}
                    <td className="num">{r.closing.toFixed(2)}</td>
                    <td className="num" style={{ color: d === 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                      {r.entered || edits[keyOf(r)] ? (d === 0 ? 'जुळते' : d.toFixed(2)) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
