import { useEffect, useState } from 'react';
import client from '../api/client';
import { useYear } from '../context/YearContext';

export default function Dashboard() {
  const { yearId, currentYear } = useYear();
  const [summary, setSummary] = useState([]);
  const [oldNewRows, setOldNewRows] = useState([]);
  const [propertyCount, setPropertyCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      client.get('/reports/summary', { params: { yearId } }),
      client.get('/reports/old-new-comparison', { params: { yearId } }),
      client.get('/properties', { params: { page: 1, pageSize: 1 } }),
    ]).then(([sumRes, oldNewRes, propRes]) => {
      if (cancelled) return;
      setSummary(sumRes.data);
      setOldNewRows(oldNewRes.data.rows);
      setPropertyCount(propRes.data.total);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [yearId]);

  const grandTotal = summary.reduce((s, r) => s + Number(r.total_tax || 0), 0);
  const gharpattiTotal = summary.reduce((s, r) => s + Number(r.gharpatti || 0), 0);
  const divabattiTotal = summary.reduce((s, r) => s + Number(r.divabatti || 0), 0);
  const arogyaTotal = summary.reduce((s, r) => s + Number(r.arogya || 0), 0);
  const panipattiTotal = summary.reduce((s, r) => s + Number(r.panipatti || 0), 0);

  // कर भरणा (जमा) व येणे कर (उर्वरित बाकी) - येणे बाकी अहवालाचीच आकडेवारी
  // (कोड-निहाय अँकर ओळीवरच नोंदलेली, बाकीच्या ओळींना ० - दुहेरी मोजणी
  // टाळण्यासाठी, पहा reports.routes.js /old-new-comparison).
  const collectedTotal = oldNewRows.reduce((s, r) => s + Number(r.collected_amount || 0), 0);
  const collectedGharpatti = oldNewRows.reduce((s, r) => s + Number(r.collected_gharpatti || 0), 0);
  const collectedDivabatti = oldNewRows.reduce((s, r) => s + Number(r.collected_divabatti || 0), 0);
  const collectedArogya = oldNewRows.reduce((s, r) => s + Number(r.collected_arogya || 0), 0);
  const collectedPanipatti = oldNewRows.reduce((s, r) => s + Number(r.collected_panipatti || 0), 0);

  const remainingTotal = oldNewRows.reduce((s, r) => s + Number(r.remaining_due || 0), 0);
  const remainingGharpatti = oldNewRows.reduce((s, r) => s + Number(r.remaining_gharpatti || 0), 0);
  const remainingDivabatti = oldNewRows.reduce((s, r) => s + Number(r.remaining_divabatti || 0), 0);
  const remainingArogya = oldNewRows.reduce((s, r) => s + Number(r.remaining_arogya || 0), 0);
  const remainingPanipatti = oldNewRows.reduce((s, r) => s + Number(r.remaining_panipatti || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>डॅशबोर्ड {currentYear ? `— ${currentYear.year_label}` : ''}</h1>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <>
          <SectionTitle color={COLORS.assessment}>सध्या कराची माहिती</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="एकूण मिळकती" value={propertyCount ?? '-'} color={COLORS.assessment} />
            <StatCard label="घरपट्टी" value={gharpattiTotal.toFixed(2)} color={COLORS.assessment} />
            <StatCard label="दिवाबत्ती" value={divabattiTotal.toFixed(2)} color={COLORS.assessment} />
            <StatCard label="आरोग्य कर" value={arogyaTotal.toFixed(2)} color={COLORS.assessment} />
            <StatCard label="पाणीपट्टी" value={panipattiTotal.toFixed(2)} color={COLORS.assessment} />
            <StatCard label="एकूण कर मागणी" value={grandTotal.toFixed(2)} color={COLORS.assessment} highlight />
          </div>

          <SectionTitle color={COLORS.collected}>कर भरणा (जमा)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="घरपट्टी" value={collectedGharpatti.toFixed(2)} color={COLORS.collected} />
            <StatCard label="दिवाबत्ती" value={collectedDivabatti.toFixed(2)} color={COLORS.collected} />
            <StatCard label="आरोग्य कर" value={collectedArogya.toFixed(2)} color={COLORS.collected} />
            <StatCard label="पाणीपट्टी" value={collectedPanipatti.toFixed(2)} color={COLORS.collected} />
            <StatCard label="एकूण जमा" value={collectedTotal.toFixed(2)} color={COLORS.collected} highlight />
          </div>

          <SectionTitle color={COLORS.remaining}>येणे कर (उर्वरित बाकी)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <StatCard label="घरपट्टी" value={remainingGharpatti.toFixed(2)} color={COLORS.remaining} />
            <StatCard label="दिवाबत्ती" value={remainingDivabatti.toFixed(2)} color={COLORS.remaining} />
            <StatCard label="आरोग्य कर" value={remainingArogya.toFixed(2)} color={COLORS.remaining} />
            <StatCard label="पाणीपट्टी" value={remainingPanipatti.toFixed(2)} color={COLORS.remaining} />
            <StatCard label="एकूण येणे बाकी" value={remainingTotal.toFixed(2)} color={COLORS.remaining} highlight />
          </div>
        </>
      )}
    </div>
  );
}

// तिन्ही गटांना वेगवेगळा रंग - सध्या कराची माहिती (निळा), जमा (हिरवा),
// येणे बाकी (केशरी) - जेणेकरून एका नजरेत कोणता गट कोणता ते ओळखता यावे.
const COLORS = { assessment: '#1d4ed8', collected: '#15803d', remaining: '#c2410c' };

function SectionTitle({ color, children }) {
  return (
    <h2 style={{ fontSize: 17, fontWeight: 800, color, margin: '0 0 10px' }}>{children}</h2>
  );
}

function StatCard({ label, value, color, highlight }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}`, borderColor: highlight ? color : undefined }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? color : 'inherit' }}>{value}</div>
    </div>
  );
}
