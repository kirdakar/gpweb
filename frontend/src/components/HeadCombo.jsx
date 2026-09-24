import { useMemo, useState } from 'react';

// लेखाशीर्ष शोधून निवडण्याचा combo (कोड/नाव टाईप करा). फक्त दिलेल्या गटातील
// (जमा/खर्च) शेवटची (leaf) शीर्षे दाखवतो. value = निवडलेले head id.
export default function HeadCombo({ heads, groupType, value, onChange, disabled }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const leaves = useMemo(() => heads.filter((h) => h.is_leaf && h.group_type === groupType), [heads, groupType]);
  const term = text.trim().toLowerCase();
  const results = useMemo(() => (term ? leaves.filter((h) => h.name.toLowerCase().includes(term) || h.code.toLowerCase().includes(term)) : leaves), [leaves, term]);
  const selected = leaves.find((h) => String(h.id) === String(value));
  const shown = open ? text : (selected ? `${selected.code} - ${selected.name}` : text);

  return (
    <div className="combo-wrap">
      <input
        value={shown} disabled={disabled}
        onChange={(e) => { setText(e.target.value); onChange(''); setOpen(true); }}
        onFocus={() => { setText(''); setOpen(true); }}
        onBlur={() => setOpen(false)}
        placeholder="कोड किंवा नाव टाइप करा"
        style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 6 }}
      />
      {open && (
        <div className="combo-dropdown">
          {results.length === 0 && <div className="combo-empty">जुळणारे शीर्ष सापडले नाही</div>}
          {results.map((h) => <div key={h.id} className="combo-option" onMouseDown={() => { onChange(h.id); setText(''); setOpen(false); }}>{h.code} - {h.name}</div>)}
        </div>
      )}
    </div>
  );
}
