import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';

// नमुना १२ - आकस्मिक खर्चाचे प्रमाणक. वेगळी नोंदवही नाही - निवडलेल्या
// cash_book_entries (नमुना ५/१८) खर्च नोंदीचेच कागदी-नमुन्यातील प्रिंट स्वरूप.
export default function VoucherPrint() {
  const { id } = useParams();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get(`/cash-book/${id}/voucher`)
      .then(({ data }) => setRow(data))
      .catch((err) => setError(err.response?.data?.error || 'प्रमाणक लोड करताना त्रुटी आली'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>आकस्मिक खर्चाचे प्रमाणक (नमुना १२)</h1>
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
            <p style={{ fontWeight: 700 }}>आकस्मिक खर्चाचे प्रमाणक (नमुना १२)</p>
          </div>
          <p>देयक क्रमांक: {row.reference_no || `#${row.id}`} | दिनांक: {row.entry_date?.slice(0, 10)}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>मागविलेल्या वस्तूचे/मालाचे नाव</th><th>लेखाशीर्ष</th><th className="num">रक्कम</th></tr></thead>
              <tbody>
                <tr>
                  <td>{row.narration || '-'}</td>
                  <td>{row.head_code} - {row.head_name}</td>
                  <td className="num">{Number(row.amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>रक्कम अक्षरी: {amountToMarathiWords(row.amount)}</p>
          <p>असे प्रमाणित करण्यात येते की, या देयकात दर्शविलेले दर व राशी योग्य आहेत आणि या वस्तू मी स्वीकारल्या आहेत.</p>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
            <span>ज्या व्यक्तीने वस्तू स्वीकारल्या त्या व्यक्तीची सही .......................</span>
          </div>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
            <span>सचिव .......................</span>
            <span>सरपंच .......................</span>
          </div>
          <p style={{ marginTop: 20 }}>रक्कम स्वीकारणाऱ्याची सही .......................</p>
        </div>
      )}
    </div>
  );
}
