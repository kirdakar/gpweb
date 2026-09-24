import { useEffect, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';

// नमुना १५ - उपभोग्य वस्तू साठा लेखा नोंदवही (प्रिंट). डाटाएंट्री StockEntry.jsx वर.
export default function StockReport() {
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [data, setData] = useState({ movements: [], balance: 0 });

  useEffect(() => { client.get('/stock/items').then(({ data: d }) => setItems(d)); }, []);
  useEffect(() => {
    if (!itemId) { setData({ movements: [], balance: 0 }); return; }
    client.get('/stock/movements', { params: { itemId } }).then(({ data: d }) => setData(d));
  }, [itemId]);
  const item = items.find((i) => String(i.id) === String(itemId));

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>उपभोग्य वस्तू साठा अहवाल (नमुना १५)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!item || !can('reports_stock', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>
      <div className="card no-print" style={{ marginBottom: 20 }}>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ minWidth: 300 }}>
          <option value="">-- वस्तू निवडा --</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </select>
      </div>
      {item && (
        <>
          <div className="print-header">
            <h2>{gpLine}</h2>
            <p style={{ fontWeight: 700 }}>उपभोग्य वस्तू साठा लेखा नोंदवही (नमुना १५)</p>
            <p>वस्तू: {item.name} ({item.unit})</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>तारीख</th><th className="num">प्रारंभिक शिल्लक</th><th className="num">मिळालेली संख्या</th><th className="num">एकूण</th><th>कोणास दिले/प्रयोजन</th><th className="num">दिलेली संख्या</th><th className="num">शिल्लक</th><th>देणाऱ्या अधिकाऱ्याचे नाव</th><th>घेणाऱ्याची सही</th><th>शेरा</th></tr>
              </thead>
              <tbody>
                {data.movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.move_date}</td><td className="num">{m.opening_before}</td><td className="num">{m.received || ''}</td><td className="num">{m.total_available}</td>
                    <td>{m.purpose_to || ''}</td><td className="num">{m.issued || ''}</td><td className="num">{m.balance_after}</td>
                    <td>{m.officer_name || ''}</td><td>{m.receiver_name || ''}</td><td>{m.remark || (m.kind === 'प्रारंभिक' ? 'प्रारंभिक शिल्लक' : '')}</td>
                  </tr>
                ))}
                {data.movements.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center' }}>नोंदी नाहीत</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 16, fontSize: 13 }}>टीप - हाती असलेला साठा बरोबर आहे की नाही याबाबत सरपंचाने ठरावीक काळाने व आवश्यकता भासल्यास वर्षाच्या शेवटी पडताळणी करावी.</p>
        </>
      )}
    </div>
  );
}
