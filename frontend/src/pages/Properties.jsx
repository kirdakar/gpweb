import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import CloseReportButton from '../components/CloseReportButton';

export default function Properties() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // मालकाचे नाव नोंदलेले नसलेल्या (यादीत नुसता "कोड X" दिसणाऱ्या) नोंदी तात्पुरत्या लपवण्यासाठी -
  // डीफॉल्ट लपवलेल्याच, गरज पडल्यास टिक काढून परत दाखवता येतात (डेटा मिटत नाही).
  const [hideMissingOwner, setHideMissingOwner] = useState(true);
  const [missingOwnerCount, setMissingOwnerCount] = useState(0);

  // शोध बदलल्यावर पहिल्या पानावर परत जा (नाहीतर जुन्या शोधाचे पान 3
  // उघडे राहून नवीन शोधात तितकी पाने नसतील तर रिकामे दिसू शकते).
  useEffect(() => { setPage(1); }, [debouncedSearch, hideMissingOwner]);

  const load = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const { data } = await client.get('/properties', {
        params: { search: debouncedSearch, page, pageSize: 25, yearId, hideMissingOwner: hideMissingOwner ? '1' : '0' },
      });
      setRows(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setMissingOwnerCount(data.missingOwnerCount || 0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, yearId, hideMissingOwner]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page property-list-page">
      <div className="page-header">
        <h1>मिळकत नोंदी {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('properties', 'add') && <Link className="btn" to="/properties/new">+ नवीन मिळकत</Link>}
          <CloseReportButton />
        </div>
      </div>

      <form className="search-bar" onSubmit={(e) => e.preventDefault()} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="मालक, मालमत्ता क्र., कोड किंवा अ.क्र. टाइप करा (शोध आपोआप होतो)" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 400, whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={hideMissingOwner} onChange={(e) => setHideMissingOwner(e.target.checked)} />
          मालकाचे नाव नसलेल्या नोंदी लपवा
          {missingOwnerCount > 0 && <span style={{ color: 'var(--text-muted)' }}>({missingOwnerCount})</span>}
        </label>
      </form>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <div className="table-wrap">
            <table className="property-rows-table">
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8.6%' }} />
                <col style={{ width: '8.6%' }} />
                <col style={{ width: '8.6%' }} />
                <col style={{ width: '8.6%' }} />
                <col style={{ width: '8.6%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>कोड</th><th>मालकाचे नाव</th><th>अ.क्र.</th><th>मालमत्ता क्र.</th><th>बांधकाम प्रकार</th>
                  <th className="num">घरपट्टी</th><th className="num">दिवाबत्ती</th><th className="num">आरोग्य</th>
                  <th className="num">पाणीपट्टी</th><th className="num">एकूण</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/properties/${r.id}`)}>
                    <td>{r.property_code ?? '-'}</td>
                    <td className="col-wrap">
                      {r.owner_name}
                      {r.spouse_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>पत्नी - {r.spouse_name}</div>}
                    </td>
                    <td>{r.srno ?? '-'}</td>
                    <td>{r.malmata_no ?? '-'}</td>
                    <td className="col-wrap">{r.construction_type_name || '-'}</td>
                    <td className="num">{r.gharpatti != null ? Number(r.gharpatti).toFixed(2) : '-'}</td>
                    <td className="num">{r.divabatti != null ? Number(r.divabatti).toFixed(2) : '-'}</td>
                    <td className="num">{r.arogya != null ? Number(r.arogya).toFixed(2) : '-'}</td>
                    <td className="num">{r.panipatti != null ? Number(r.panipatti).toFixed(2) : '-'}</td>
                    <td className="num">{r.total_tax != null ? Number(r.total_tax).toFixed(2) : '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link className="btn secondary small" to={`/properties/${r.id}`}>उघडा</Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>नोंदी सापडल्या नाहीत</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>एकूण {total} नोंदी</span>
            <button className="btn secondary small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>मागे</button>
            <span>पान {page} / {totalPages || 1}</span>
            <button className="btn secondary small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>पुढे</button>
          </div>
        </>
      )}
    </div>
  );
}
