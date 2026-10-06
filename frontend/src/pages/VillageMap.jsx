import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import CloseReportButton from '../components/CloseReportButton';
import VillageMapView from '../components/VillageMapView';

// गावाचा नकाशा - अक्षांश/रेखांश (latlong) नोंदवलेल्या सर्व मिळकती एकाच नकाशावर.
export default function VillageMap() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('malmata') || '');
  const [focus, setFocus] = useState(params.get('malmata') || '');

  useEffect(() => {
    client.get('/latlong').then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);

  const openProperty = useCallback((id) => navigate(`/properties/${id}`), [navigate]);

  // शोध: मालमत्ता क्र., कोड किंवा मालकाचे नाव - जुळणारी पहिली मिळकत नकाशावर ठळक होते.
  const match = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return null;
    return items.find((it) => String(it.malmata_no).toLowerCase() === t)
      || items.find((it) => it.property && String(it.property.property_code) === t)
      || items.find((it) => (it.property?.owner_name || '').toLowerCase().includes(t))
      || null;
  }, [items, search]);

  useEffect(() => { setFocus(match ? match.malmata_no : ''); }, [match]);

  return (
    <div className="page data-entry-page">
      <div className="page-header">
        <h1>गावाचा नकाशा — मिळकती ({items.length})</h1>
        <CloseReportButton />
      </div>
      <div className="search-bar">
        <input placeholder="मालमत्ता क्र., कोड किंवा मालकाचे नाव टाइप करा" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && !match && <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>जुळणारी मिळकत नकाशावर नाही</span>}
      </div>
      {loading ? <p>लोड होत आहे...</p> : items.length === 0 ? (
        <p>अजून कोणत्याही मिळकतीचे अक्षांश/रेखांश नोंदवलेले नाहीत. मिळकत नोंद स्क्रीनवर ते भरता येतात.</p>
      ) : (
        <VillageMapView items={items} focusMalmata={focus} height={Math.max(420, window.innerHeight - 260)} onOpenProperty={openProperty} />
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        नकाशाचे पार्श्वचित्र (उपग्रह/रस्ते) इंटरनेट असेल तरच दिसते; इंटरनेटशिवाय मिळकतींचे आकार व क्रमांक दिसतात.
        मिळकतीवर क्लिक केल्यास मालकाची माहिती दिसते.
      </p>
    </div>
  );
}
