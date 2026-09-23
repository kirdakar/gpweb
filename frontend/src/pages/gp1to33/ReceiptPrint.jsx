import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';

// नमुना ७ - सामान्य पावती. वेगळी नोंदवही नाही - निवडलेल्या cash_book_entries
// (नमुना ५/१८) जमा नोंदीचेच कागदी-नमुन्यातील प्रिंट स्वरूप.
export default function ReceiptPrint() {
  const { id } = useParams();
  const { can } = usePermissions();
  const { gpLine } = useGpSettings();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get(`/cash-book/${id}/receipt`)
      .then(({ data }) => setRow(data))
      .catch((err) => setError(err.response?.data?.error || 'पावती लोड करताना त्रुटी आली'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>पावती (नमुना ७)</h1>
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
          </div>
          <p>पुस्तक क्रमांक ....................... पावती क्रमांक {row.reference_no || `#${row.id}`}</p>
          <p>दिनांक: {row.entry_date?.slice(0, 10)}</p>
          <p style={{ lineHeight: 2 }}>
            श्री./श्रीमती ....................................... कडून <strong>{row.head_name}</strong> ({row.narration || '-'}) बद्दल
            रुपये <strong>{Number(row.amount).toFixed(2)}</strong> (अक्षरी रुपये {amountToMarathiWords(row.amount)}) एवढी रक्कम मिळाली.
          </p>
          <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between' }}>
            <span>सचिव .......................</span>
            <span>सरपंच .......................</span>
          </div>
        </div>
      )}
    </div>
  );
}
