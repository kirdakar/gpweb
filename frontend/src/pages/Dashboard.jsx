import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';

export default function Dashboard() {
  const { yearId, currentYear } = useYear();
  const { can } = usePermissions();
  const [summary, setSummary] = useState([]);
  const [propertyCount, setPropertyCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      client.get('/reports/summary', { params: { yearId } }),
      client.get('/properties', { params: { page: 1, pageSize: 1 } }),
    ]).then(([sumRes, propRes]) => {
      if (cancelled) return;
      setSummary(sumRes.data);
      setPropertyCount(propRes.data.total);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [yearId]);

  const grandTotal = summary.reduce((s, r) => s + Number(r.grand_total || 0), 0);
  const gharpattiTotal = summary.reduce((s, r) => s + Number(r.total_gharpatti || 0), 0);
  const divabattiTotal = summary.reduce((s, r) => s + Number(r.total_divabatti || 0), 0);
  const arogyaTotal = summary.reduce((s, r) => s + Number(r.total_arogya || 0), 0);
  const panipattiTotal = summary.reduce((s, r) => s + Number(r.total_panipatti || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>डॅशबोर्ड {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard label="एकूण मिळकती" value={propertyCount ?? '-'} />
            <StatCard label="घरपट्टी" value={gharpattiTotal.toFixed(2)} />
            <StatCard label="दिवाबत्ती" value={divabattiTotal.toFixed(2)} />
            <StatCard label="आरोग्य कर" value={arogyaTotal.toFixed(2)} />
            <StatCard label="पाणीपट्टी" value={panipattiTotal.toFixed(2)} />
            <StatCard label="एकूण कर मागणी" value={grandTotal.toFixed(2)} highlight />
          </div>

          <div className="card">
            <h2 style={{ fontSize: 15, marginTop: 0 }}>पटकन जा</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {can('properties', 'add') && <Link className="btn" to="/properties/new">+ नवीन मिळकत नोंद</Link>}
              {can('payments', 'view') && <Link className="btn" to="/payments">कर जमा भरणे</Link>}
              {can('reports_property_list', 'view') && <Link className="btn secondary" to="/reports/property-list">मिळकत यादी अहवाल</Link>}
              {can('reports_old_new', 'view') && <Link className="btn secondary" to="/reports/old-new">येणे बाकी अहवाल</Link>}
              {can('reports_summary', 'view') && <Link className="btn secondary" to="/reports/summary">मालकनिहाय सारांश</Link>}
              {can('reports_payment_receipts', 'view') && <Link className="btn secondary" to="/reports/payment-receipts">जमा पावती अहवाल</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className="card" style={highlight ? { borderColor: 'var(--primary)' } : undefined}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? 'var(--primary)' : 'inherit' }}>{value}</div>
    </div>
  );
}
