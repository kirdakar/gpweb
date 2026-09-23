import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';

// नमुना ३२ - रकमेच्या परताव्यासाठीचा आदेश. वेगळी नोंदवही नाही - निवडलेल्या
// cash_book_entries (नमुना ५/१८, किंवा नमुना १७ च्या अनामत-परतफेडीतून आलेली)
// खर्च नोंदीचेच कागदी-नमुन्यातील परतावा-आदेश-पत्र स्वरूप.
export default function RefundOrderPrint() {
  const { id } = useParams();
  const { can } = usePermissions();
  const { gpLine, settings } = useGpSettings();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get(`/cash-book/${id}/refund`)
      .then(({ data }) => setRow(data))
      .catch((err) => setError(err.response?.data?.error || 'परतावा आदेश लोड करताना त्रुटी आली'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>रकमेच्या परताव्यासाठीचा आदेश (नमुना ३२)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => window.print()} disabled={!row || !can('reports_receipt_voucher', 'print')}>प्रिंट</button>
          <CloseReportButton />
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <p>लोड होत आहे...</p>}

      {row && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="print-header">
            <h2>{gpLine}</h2>
            <p style={{ fontWeight: 700 }}>रकमेच्या परताव्यासाठीचा आदेश (नमुना ३२)</p>
          </div>
          <p>मूळ पावती क्रमांक: {row.reference_no || '.......................'} | मूळ रक्कम दिनांक: .......................</p>
          <p>उधारीचे नाव/तपशील: {row.narration || '-'} | लेखाशीर्ष: {row.head_code} - {row.head_name}</p>

          <p style={{ marginTop: 20 }}>दिनांक: {row.entry_date?.slice(0, 10)}</p>
          <p style={{ lineHeight: 2 }}>
            श्री./श्रीमती ....................................... यांस रुपये <strong>{Number(row.amount).toFixed(2)}</strong> (अक्षरी रुपये {amountToMarathiWords(row.amount)})
            परत करावयाचा आदेश देण्यात येत आहे.
          </p>
          <p>रोख/धनादेश क्रमांक ....................................... द्वारे उपरोक्त रक्कम परत मिळाली.</p>

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
            <span>रक्कम स्वीकारणाऱ्याची सही .......................</span>
          </div>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
            <span>सचिव .......................</span>
            <span>सरपंच{settings?.gp_name ? `, ${settings.gp_name}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}
