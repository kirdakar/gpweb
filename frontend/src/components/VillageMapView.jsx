import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// गावाचा नकाशा (Leaflet) - प्रत्येक मिळकतीचे ४ कोपऱ्यांचे अक्षांश/रेखांश जोडून आकार (polygon)
// दाखवतो. नकाशाचे पार्श्वचित्र (रस्ते/उपग्रह) इंटरनेट असेल तरच दिसते; इंटरनेट नसताना
// (ऑफलाइन/LAN) पार्श्वचित्र रिकामे राहते, पण मिळकतींचे आकार व क्रमांक तसेच दिसतात.
// items: [{ malmata_no, points: [{latitude, longitude}], property: {id, property_code, owner_name, spouse_name} | null }]
// focusMalmata: हा मालमत्ता क्रमांक लाल रंगात ठळक करून त्यावर झूम करतो.
export default function VillageMapView({ items, focusMalmata, height = 520, onOpenProperty, focusMaxZoom = 20 }) {
  const elRef = useRef(null);

  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true, preferCanvas: false });
    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 21, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap',
    });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21, maxNativeZoom: 18, attribution: 'Esri World Imagery',
    });
    satellite.addTo(map);
    L.control.layers({ 'उपग्रह (Satellite)': satellite, 'रस्ते (Street)': street }).addTo(map);

    const all = [];
    let focusBounds = null;
    for (const it of items) {
      const latlngs = it.points.map((p) => [p.latitude, p.longitude]);
      if (latlngs.length === 0) continue;
      const isFocus = focusMalmata && String(focusMalmata) === String(it.malmata_no);
      const color = isFocus ? '#dc2626' : '#2563eb';
      const shape = latlngs.length >= 3
        ? L.polygon(latlngs, { color, weight: isFocus ? 3 : 2, fillColor: color, fillOpacity: isFocus ? 0.45 : 0.3 })
        : L.polyline(latlngs, { color, weight: 3 });
      shape.addTo(map);
      shape.bindTooltip(String(it.malmata_no), { permanent: true, direction: 'center', className: 'village-map-label' });

      const box = document.createElement('div');
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = `मालमत्ता क्र. ${it.malmata_no}`;
      box.appendChild(title);
      if (it.property) {
        const l1 = document.createElement('div');
        l1.textContent = `कोड ${it.property.property_code ?? '-'} - ${it.property.owner_name || ''}`;
        box.appendChild(l1);
        if (it.property.spouse_name) {
          const l2 = document.createElement('div');
          l2.textContent = `पत्नी - ${it.property.spouse_name}`;
          box.appendChild(l2);
        }
        if (onOpenProperty) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'मिळकत उघडा';
          btn.style.cssText = 'margin-top:6px;padding:3px 10px;cursor:pointer';
          btn.onclick = () => onOpenProperty(it.property.id);
          box.appendChild(btn);
        }
      }
      shape.bindPopup(box);

      all.push(...latlngs);
      if (isFocus) focusBounds = shape.getBounds();
    }

    if (focusBounds) map.fitBounds(focusBounds, { maxZoom: focusMaxZoom, padding: [40, 40] });
    else if (all.length) map.fitBounds(all, { maxZoom: 18, padding: [30, 30] });
    else map.setView([17.9107, 74.9815], 15);

    return () => map.remove();
  }, [items, focusMalmata, focusMaxZoom, onOpenProperty]);

  return <div ref={elRef} style={{ height, width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: '#e5e7eb' }} />;
}
