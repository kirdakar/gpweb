import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useYear } from '../../context/YearContext';
import { usePermissions } from '../../context/PermissionsContext';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import CloseReportButton from '../../components/CloseReportButton';

export default function TaxDemandReport() {
  const { years, yearId, setYearId } = useYear();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [matches, setMatches] = useState([]);
  const [code, setCode] = useState('');
  const [portions, setPortions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) { setMatches([]); return; }
    client.get('/properties', { params: { search: debouncedSearch, page: 1, pageSize: 20, yearId } })
      .then(({ data }) => setMatches(data.data));
  }, [debouncedSearch, yearId]);

  // शोध निकाल कोड नंबरवर ग्रुप करून दाखवतो - एका कोडखाली अनेक मालमत्ता
  // असल्या तरी नाव एकदाच दिसावे (डबल-डबल नांवे नकोत); हे बिलही कोडनिहायच
  // (सर्व मालमत्ता एकत्र) तयार होते.
  const matchGroups = useMemo(() => {
    const map = new Map();
    for (const m of matches) {
      if (m.property_code == null) continue;
      if (!map.has(m.property_code)) {
        map.set(m.property_code, { property_code: m.property_code, owner_name: m.owner_name, malmata_nos: [] });
      }
      map.get(m.property_code).malmata_nos.push(m.malmata_no);
    }
    return [...map.values()];
  }, [matches]);

  async function loadForCode(value) {
    setCode(value);
    setPortions(null);
    if (!value || !yearId) return;
    setLoading(true);
    try {
      const { data } = await client.get('/reports/tax-demand-by-code', { params: { code: value, yearId } });
      setPortions(data);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setSearch('');
    setMatches([]);
    setCode('');
    setPortions(null);
  }

  const yearLabel = years.find((y) => y.id === yearId)?.year_label || '';
  const grandTotal = (portions || []).reduce((s, p) => s + Number(p.total_tax || 0), 0);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>कर आकारणी पावती (Tax Demand Notice)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.year_label}</option>)}
          </select>
          {portions && <button className="btn secondary" onClick={() => window.print()} disabled={!can('reports_tax_demand', 'print')}>प्रिंट</button>}
          <CloseReportButton />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: matchGroups.length ? 12 : 0 }}>
          <input placeholder="मालकाचे नाव किंवा कोड टाइप करा (शोध आपोआप होतो)" value={search} onChange={(e) => setSearch(e.target.value)} />
          <input placeholder="किंवा थेट कोड टाका" value={code} onChange={(e) => loadForCode(e.target.value)} style={{ width: 200, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn secondary" type="button" onClick={clearSearch} disabled={!search && !code && !portions}>शोध क्लिअर करा</button>
        </div>
        {matchGroups.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>कोड</th><th>मालमत्ता क्र.</th><th>मालकाचे नाव</th><th></th></tr></thead>
              <tbody>
                {matchGroups.map((g) => (
                  <tr key={g.property_code}>
                    <td>{g.property_code}</td><td>{g.malmata_nos.join(', ')}</td><td>{g.owner_name}</td>
                    <td><button className="btn small" onClick={() => loadForCode(g.property_code)}>निवडा</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading && <p>लोड होत आहे...</p>}

      {portions && (
        <div className="card">
          <div className="print-header">
            <h2>ग्रामपंचायत — कर आकारणी पावती</h2>
            <p>आर्थिक वर्ष: {yearLabel} | कोड: {code}</p>
          </div>
          <p><strong>मालकाचे नाव:</strong> {portions[0]?.owner_name || '-'}</p>
          <p><strong>भोगवटादार:</strong> {portions[0]?.bhogvatdar || '-'}</p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>मालमत्ता क्र.</th><th>बांधकाम प्रकार</th>
                  <th className="num">घरपट्टी</th><th className="num">दिवाबत्ती</th><th className="num">आरोग्य</th><th className="num">पाणीपट्टी</th><th className="num">एकूण</th>
                </tr>
              </thead>
              <tbody>
                {portions.map((p) => (
                  <tr key={p.property_id}>
                    <td>{p.malmata_no ?? '-'}</td>
                    <td>{p.construction_type_name || '-'}</td>
                    <td className="num">{Number(p.gharpatti || 0).toFixed(2)}</td>
                    <td className="num">{Number(p.divabatti || 0).toFixed(2)}</td>
                    <td className="num">{Number(p.arogya || 0).toFixed(2)}</td>
                    <td className="num">{Number(p.panipatti || 0).toFixed(2)}</td>
                    <td className="num">{Number(p.total_tax || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {portions.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center' }}>या कोड साठी नोंदी नाहीत</td></tr>}
              </tbody>
              {portions.length > 0 && (
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={6}>एकूण देय कर</td>
                    <td className="num">{grandTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
