import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';
import { fmtDate } from '../../utils/formatDate';

// नोंद कर जमा भरणेतून (tax_payments) आलेली असल्यास narration च्या शेवटी
// "- पावती घ-6" असा संदर्भ जोडलेला असतो (पहा backend taxCashPosting.js) -
// तो आता पावती नं. स्वतंत्रपणे वरच दाखवला जात असल्याने इथे पुन्हा नको.
function displayNarration(narration) {
  return (narration || '-').replace(/\s*-\s*पावती\s+\S+\s*$/, '');
}

// पावती नं. नेहमी साधा आकडा (१ ते ९९९९९) हवा - "घ-6"/"पा-12" सारखा
// संदर्भ असल्यास त्यातील आकडाच घेतो, नसल्यास (सर्वसाधारण रोकडवही नोंद)
// नोंदीचा id वापरतो.
function receiptNumber(row) {
  const m = (row.reference_no || '').match(/(\d+)\s*$/);
  return m ? m[1] : row.id;
}

function ReceiptCopy({ row, gpLine, copyLabel }) {
  const payerName = row.property_code
    ? `कोड ${row.property_code}${row.owner_name ? ` - ${row.owner_name}` : ''}`
    : null;

  return (
    <div style={{ padding: '10px 0', pageBreakInside: 'avoid' }}>
      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginBottom: -6 }}>{copyLabel}</div>
      <div className="print-header">
        <h2>{gpLine}</h2>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>दिनांक: {fmtDate(row.entry_date)}</span>
        <span>पावती नं. {receiptNumber(row)}</span>
      </div>
      <p>मालमत्ता क्रं. {row.malmata_no || '.......................'}</p>
      <p style={{ lineHeight: 2 }}>
        श्री./श्रीमती {payerName || '.......................'} कडून <strong>{row.head_name}</strong> ({displayNarration(row.narration)}) बद्दल
        रुपये <strong>{Number(row.amount).toFixed(2)}</strong> (अक्षरी रुपये {amountToMarathiWords(row.amount)}) एवढी रक्कम मिळाली.
      </p>
      <div style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between' }}>
        <span>सचिव .......................</span>
        <span>सरपंच .......................</span>
      </div>
    </div>
  );
}

// नमुना ७ - सामान्य पावती. वेगळी नोंदवही नाही - निवडलेल्या cash_book_entries
// (नमुना ५/१८) जमा नोंदीचेच कागदी-नमुन्यातील प्रिंट स्वरूप. एका A4 पानावर
// दोन प्रती (कार्यालय प्रत + संबंधित व्यक्तीसाठी) छापतो, दरवेळी हाताने
// दोनदा भरावे लागू नये म्हणून.
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
          <ReceiptCopy row={row} gpLine={gpLine} copyLabel="कार्यालय प्रत (OC)" />
          <div style={{ borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
          <ReceiptCopy row={row} gpLine={gpLine} copyLabel="संबंधित व्यक्तीसाठी" />
        </div>
      )}
    </div>
  );
}
