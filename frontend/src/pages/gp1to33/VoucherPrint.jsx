import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';
import { fmtDate } from '../../utils/formatDate';

const fmt = (n) => Number(n || 0).toFixed(2);
const DOTS = '....................';
const line = (w = 110) => <span style={{ display: 'inline-block', borderBottom: '1px dashed #000', width: w }} />;

// नमुना १२ - आकस्मिक खर्चाचे प्रमाणक (कागदी नमुन्यानुसार). वेगळी नोंदवही नाही - निवडलेल्या
// cash_book_entries (नमुना ५/१८) खर्च नोंदीवरूनच: देयक क्रमांक, वस्तू/तपशील, रक्कम, दिनांक;
// (१) वाटणीची रक्कम = नमुना १ चा मंजूर अंदाज, (२) पूर्वीचा खर्च = याच शीर्षावरील याआधीचा खर्च -
// दोन्ही आपोआप (backend /cash-book/:id/voucher), त्यामुळे एकूण बेरीज व उपलब्ध शिल्लकही आपोआप.
export default function VoucherPrint() {
  const { id } = useParams();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
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

  const gpShort = (settings.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

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

      {row && (() => {
        const amount = Number(row.amount);
        const total = Number(row.previous_expense) + amount;
        const balance = Number(row.allocation_amount) - total;
        const rupees = Math.floor(amount);
        const paise = Math.round((amount - rupees) * 100);
        const words = amountToMarathiWords(amount);
        return (
          <div className="card voucher-form" style={{ maxWidth: 780, fontSize: 14, lineHeight: 1.9 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>नमुना १२</div>
              <div>(नियम २४(ग) (४), (५) व (६), ४४(१) व (४) (आ) पाहा)</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>आकस्मिक खर्चाचे प्रमाणक</div>
              <div>(घेतलेल्या वस्तू व त्यासाठी केलेले प्रदान यांची नोंदवही)</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span>ग्रामपंचायत <strong>{gpShort || DOTS}</strong></span>
              <span>देयक क्रमांक <strong>{row.reference_no || `#${row.id}`}</strong></span>
            </div>

            <table style={{ width: '100%', marginTop: 6, tableLayout: 'fixed' }}>
              <colgroup><col style={{ width: '38%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /></colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ whiteSpace: 'normal' }}>मागविलेल्या वस्तूचे/मालाचे नाव<br />पंचायतीचा मंजुरी क्रमांक व दिनांक</th>
                  <th rowSpan={2} style={{ whiteSpace: 'normal' }}>नग किंवा वजन</th>
                  <th rowSpan={2}>दर</th>
                  <th rowSpan={2}>युनिट</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>रक्कम</th>
                </tr>
                <tr><th style={{ textAlign: 'center' }}>रु.</th><th style={{ textAlign: 'center' }}>पैसे</th></tr>
              </thead>
              <tbody>
                <tr style={{ height: 52 }}>
                  <td style={{ whiteSpace: 'normal', verticalAlign: 'top' }}>{row.narration || '-'}<div style={{ fontSize: 12, color: '#444' }}>({row.head_code} - {row.head_name})</div></td>
                  <td /><td /><td />
                  <td className="num">{rupees}</td>
                  <td className="num">{String(paise).padStart(2, '0')}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 8 }}>
              <div>(१) वाटणीची रक्कम <strong style={{ float: 'right', marginRight: '40%' }}>{fmt(row.allocation_amount)}</strong></div>
              <div>(२) पूर्वीचा खर्च <strong style={{ float: 'right', marginRight: '40%' }}>{fmt(row.previous_expense)}</strong></div>
              <div style={{ textAlign: 'right', maxWidth: '62%', marginLeft: 'auto', lineHeight: 1.6 }}>
                असे प्रमाणित करण्यात येते की, या देयकात दर्शविलेले दर व राशी योग्य आहेत आणि या वस्तू मी स्वीकारल्या आहेत.
              </div>
              <div>(३) देयकात दर्शविलेला खर्च <strong style={{ float: 'right', marginRight: '40%' }}>{fmt(amount)}</strong></div>
              <div style={{ paddingLeft: 24 }}><strong>एकूण बेरीज २+३</strong> <strong style={{ float: 'right', marginRight: '40%' }}>{fmt(total)}</strong></div>
              <div style={{ paddingLeft: 24 }}><strong>उपलब्ध शिल्लक</strong> <strong style={{ float: 'right', marginRight: '40%', color: balance < 0 ? 'var(--danger)' : undefined }}>{fmt(balance)}</strong></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <span>दिनांक : {fmtDate(row.entry_date)}</span>
              <span>ज्या व्यक्तीने वस्तू स्वीकारल्या त्या व्यक्तीची सही {line(90)}</span>
            </div>

            <p style={{ margin: '12px 0 4px', lineHeight: 1.6 }}>
              मंजुरीसाठी ग्रामपंचायतीला सादर. मी मागणीची चौकशी केली असून ती सर्व बाबतीत योग्य असल्याचे मत आढळून आले आहे.
            </p>
            <div style={{ textAlign: 'right' }}>सचिव {line()}<br />दिनांक {line()}</div>

            <div style={{ marginTop: 4 }}>
              <div>ठराव क्रमांक {line()}</div>
              <div>देयकामध्ये दर्शविलेली रक्कम रुपये <strong>{fmt(amount)}</strong> ( {words} ) मंजूर करण्यात येत आहे.</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>दिनांक {line()}</span><span>सरपंच {line()}</span></div>
              <div>मागणी पूर्तीची पूर्ण रुपये <strong>{fmt(amount)}</strong> (अक्षरात {words}) रक्कम मिळाली.</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span>माझ्या समक्ष रक्कम दिली.</span>
              <strong>रक्कम स्वीकारणाऱ्याची सही {line(100)}</strong>
            </div>
            <div>साक्षीदाराची सही {line(130)}</div>
            <div>प्रमाणक क्रमांक {line(130)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>रोजवहीतील पृष्ठ क्रमांक {line(130)} वर नोंद केली.</span>
              <span>सचिव {line(90)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
