import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';
import useGpSettings from '../../hooks/useGpSettings';
import { amountToMarathiWords } from '../../utils/numberToMarathiWords';
import { fmtDate, toDateInput } from '../../utils/formatDate';

const MR = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const mnum = (n) => String(n).split('').map((d) => MR[Number(d)]).join('');
const fmt = (n) => (n === '' || n == null ? '' : Number(n).toFixed(2));
const dots = (v, w = '................') => (v ? <strong>{v}</strong> : w);

// नमुना ३२ (नियम २४(क)(३) पाहा) - रकमेच्या परताव्यासाठीचा आदेश, कागदी नमुन्याप्रमाणे A4 आडव्या पानावर.
// वेगळी नोंदवही नाही - निवडलेल्या cash_book_entries (नमुना ५/१८, किंवा नमुना १७ च्या अनामत-परतफेडीतून आलेल्या) खर्च नोंदीचे
// परतावा-आदेश-पत्र. जे तपशील रोकड वहीत नसतात (प्रमाणक क्र., मूळ पावती/दिनांक/रक्कम, ठेवीदाराचे व प्राधिकाऱ्याचे नाव, ठिकाण)
// ते छापण्याआधी खालील फॉर्ममध्ये भरता येतात (आधीचे असतील ते आपोआप भरलेले दिसतात).
export default function RefundOrderPrint() {
  const { id } = useParams();
  const { can } = usePermissions();
  const { settings } = useGpSettings();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ voucher_no: '', receipt_no: '', orig_date: '', orig_amount: '', depositor: '', authority: '', place: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    setLoading(true);
    client.get(`/cash-book/${id}/refund`)
      .then(({ data }) => {
        setRow(data);
        const m = (data.narration || '').match(/ - ([^-]+?)(?: - .*)?$/); // "अनामत परतफेड/समायोजन - नाव" मधून नाव
        setF({
          voucher_no: '', receipt_no: data.reference_no || '', orig_date: toDateInput(data.reference_date),
          orig_amount: String(data.amount), depositor: m ? m[1].trim() : '', authority: '', place: '',
        });
      })
      .catch((err) => setError(err.response?.data?.error || 'परतावा आदेश लोड करताना त्रुटी आली'))
      .finally(() => setLoading(false));
  }, [id]);

  const gpName = (settings?.gp_name || '').replace(/^ग्रामपंचायत\s*/, '');

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
        <>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="form-grid">
              <div className="field"><label>प्रमाणक क्रमांक</label><input value={f.voucher_no} onChange={set('voucher_no')} /></div>
              <div className="field"><label>पावती क्रमांक (१)</label><input value={f.receipt_no} onChange={set('receipt_no')} /></div>
              <div className="field"><label>दिलेली मूळ रक्कम दिनांक (२)</label><input type="date" value={f.orig_date} onChange={set('orig_date')} /></div>
              <div className="field"><label>मूळ रक्कम (३)</label><input type="number" step="0.01" min="0" value={f.orig_amount} onChange={set('orig_amount')} /></div>
              <div className="field"><label>ठेवीदाराचे नाव (५) / श्री.</label><input value={f.depositor} onChange={set('depositor')} /></div>
              <div className="field"><label>परतावा करणाऱ्या प्राधिकाऱ्याचे नाव (६)</label><input value={f.authority} onChange={set('authority')} /></div>
              <div className="field"><label>रक्कम मिळाल्याचे ठिकाण</label><input value={f.place} onChange={set('place')} /></div>
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>हे तपशील फक्त या छापासाठी आहेत; रोकड वहीतील नोंद बदलत नाही. आदेशातील रक्कम = रोकड वहीतील ही खर्च नोंद (परत करावयाची रक्कम).</p>
          </div>

          <div className="a4-page cl-page">
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>नमुना ३२</div>
            <div style={{ textAlign: 'center', fontSize: 11 }}>(नियम २४(क)(३) पाहा)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 13, margin: '4px 0' }}>
              <span>दिनांक : <strong>{fmtDate(row.entry_date)}</strong></span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>रकमेच्या परताव्यासाठीचा आदेश</span>
              <span>प्रमाणक क्रमांक : {dots(f.voucher_no, '..............')}</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 6 }}>ग्रामपंचायत कार्यालय{gpName ? <> : <strong>{gpName}</strong></> : ''}</div>

            <table className="cl-table">
              <thead>
                <tr>
                  <th>पावती क्रमांक</th><th>दिलेली मूळ रक्कम दिनांक</th><th>रक्कम</th><th>परत करावयाची रक्कम</th><th>ठेवीदाराचे नाव</th><th>परतावा करणाऱ्या प्राधिकाऱ्याचे नाव</th>
                </tr>
                <tr className="cl-numrow">{[1, 2, 3, 4, 5, 6].map((n) => <th key={n}>({mnum(n)})</th>)}</tr>
              </thead>
              <tbody>
                <tr style={{ height: 60 }}>
                  <td className="cl-name">{f.receipt_no}</td>
                  <td>{f.orig_date ? fmtDate(f.orig_date) : ''}</td>
                  <td className="num">{fmt(f.orig_amount)}</td>
                  <td className="num"><strong>{fmt(row.amount)}</strong></td>
                  <td className="cl-name">{f.depositor}</td>
                  <td className="cl-name">{f.authority}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 22, fontSize: 13, lineHeight: 2.2 }}>
              <div>श्री. {dots(f.depositor, '........................................')} यांस रुपये <strong>{fmt(row.amount)}</strong> (अक्षरी <strong>{amountToMarathiWords(row.amount)}</strong>) दिले.</div>
              <div>रुपये <strong>{fmt(row.amount)}</strong> (अक्षरी <strong>{amountToMarathiWords(row.amount)}</strong>) इतकी रक्कम {dots(f.place, '............................')} या ठिकाणी दिनांक {dots(fmtDate(row.entry_date), '..............')} रोजी मला मिळाली.</div>
            </div>

            <div style={{ marginTop: 50, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>सचिव</span>
              <span>रक्कम स्वीकारणाऱ्याची सही</span>
              <span>सरपंच</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
