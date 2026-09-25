import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

// व्यक्ती (कोड + नाव) शोधून निवडण्याचा combo - कोड, मालकाचे नाव किंवा मालमत्ता क्र. टाइप करून शोधा.
// value = निवडलेला property_code (किंवा ''), onChange(code) . कर जमा भरणे प्रमाणेच यादी (/properties) वापरतो.
export default function PersonCombo({ yearId, value, onChange }) {
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!yearId) return;
    client.get('/properties', { params: { page: 1, pageSize: 5000, yearId } }).then(({ data }) => setRows(data.data));
  }, [yearId]);

  const options = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (r.property_code == null) continue;
      if (!map.has(r.property_code)) map.set(r.property_code, { property_code: r.property_code, owner_name: r.owner_name || '', malmata_nos: [] });
      map.get(r.property_code).malmata_nos.push(r.malmata_no);
    }
    return [...map.values()].sort((a, b) => a.property_code - b.property_code);
  }, [rows]);

  const term = text.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return options;
    return options.filter((o) => o.owner_name.toLowerCase().includes(term)
      || String(o.property_code).includes(term)
      || o.malmata_nos.some((m) => String(m || '').toLowerCase().includes(term)));
  }, [options, term]);

  const selected = options.find((o) => String(o.property_code) === String(value));
  const shown = open ? text : (selected ? `${selected.property_code} - ${selected.owner_name}` : text);

  return (
    <div className="combo-wrap">
      <input
        value={shown}
        onChange={(e) => { setText(e.target.value); onChange(''); setOpen(true); }}
        onFocus={() => { setText(''); setOpen(true); }}
        onBlur={() => setOpen(false)}
        placeholder="कोड, नाव किंवा मालमत्ता क्र. टाइप करा - क्लिक केल्यावर यादी दिसेल"
        style={{ width: '100%', padding: '8px 30px 8px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
      />
      {value !== '' && value != null && (
        <button type="button" className="combo-clear-btn" title="पुसा" onMouseDown={(e) => { e.preventDefault(); onChange(''); setText(''); setOpen(true); }}>×</button>
      )}
      {open && (
        <div className="combo-dropdown">
          {results.length === 0 && <div className="combo-empty">जुळणारी नोंद सापडली नाही</div>}
          {results.map((o) => (
            <div key={o.property_code} className="combo-option" onMouseDown={() => { onChange(o.property_code); setText(''); setOpen(false); }}>
              {o.property_code} - {o.owner_name} <span style={{ color: 'var(--text-muted)' }}>(मालमत्ता: {o.malmata_nos.join(', ')})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
