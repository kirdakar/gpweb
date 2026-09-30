import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { usePermissions } from '../context/PermissionsContext';
import CloseReportButton from '../components/CloseReportButton';
import { ReceiptPrintout } from '../components/TaxReceiptPrintout';

// कर जमा भरणे (PaymentEntry.jsx) च्या "पावती इतिहास" यादीतील "पावती पहा"
// बटणाने नवीन टॅबमध्ये उघडणारे स्वतंत्र पान - आधी हीच पावती PaymentEntry.jsx
// च्याच पानावर सध्याच्या डेटा-भरणे स्क्रीनच्या जागी दाखवली जात असे, त्यामुळे
// पुन्हा नोंदी भरायला मूळ स्क्रीनवर जावे लागे. आता वेगळ्या टॅबमध्ये उघडते,
// मूळ स्क्रीन जशीच्या तशी राहते.
export default function PaymentReceiptView() {
  const { id } = useParams();
  const { can } = usePermissions();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get(`/payments/${id}/receipt`)
      .then(({ data }) => setReceipt(data))
      .catch((err) => setError(err.response?.data?.error || 'पावती आणताना त्रुटी आली'))
      .finally(() => setLoading(false));
  }, [id]);

  const property = receipt ? {
    owner_name: receipt.dues.owner_name,
    malmata_no_list: receipt.dues.malmata_no_list,
  } : null;

  return (
    <div className="page">
      <div className="page-header no-print">
        <h1>पावती (नमुना नं. १०)</h1>
        <CloseReportButton />
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <p>लोड होत आहे...</p>}

      {receipt && (
        <ReceiptPrintout
          receipt={receipt}
          property={property}
          receiptType={receipt.payment.receipt_type}
          canPrint={can('payments', 'print')}
        />
      )}
    </div>
  );
}
