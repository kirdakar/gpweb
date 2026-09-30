import { amountToMarathiWords } from '../utils/numberToMarathiWords';

// घरपट्टी पावती (नमुना नं. १०) = घरपट्टी + दिवाबत्ती(वीज कर) + आरोग्य कर,
// पाणीपट्टी पावती (नमुना नं. १०, वेगळे पुस्तक) = फक्त पाणी पट्टी - दोन्ही
// स्वतंत्र पावती-मालिका (receipt_type). PaymentEntry.jsx (नवीन जमा करून लगेच
// दाखवणे) व PaymentReceiptView.jsx (इतिहासातील जुनी पावती नवीन टॅबमध्ये
// उघडणे) या दोन्ही ठिकाणी हाच छापील नमुना वापरतो, दुहेरी व्याख्या टाळण्यासाठी.
export const GROUP_COMPONENTS = {
  gharpatti: [
    { key: 'gharpatti', label: 'घरपट्टी' },
    { key: 'divabatti', label: 'दिवाबत्ती (वीज कर)' },
    { key: 'arogya', label: 'आरोग्य कर' },
  ],
  panipatti: [
    { key: 'panipatti', label: 'पाणी पट्टी' },
  ],
};
export const RECEIPT_LABELS = { gharpatti: 'घरपट्टी पावती', panipatti: 'पाणीपट्टी पावती' };

// खुली जागा कर/नोटीस फी/वारंट फी/इतर - या घटकांची वर्षनिहाय आकारणी प्रणालीत
// नाही (property_tax_assessment मध्ये नाहीत), त्यामुळे यांची बाकी आपोआप
// काढता येत नाही - दर पावतीच्या वेळी प्रत्यक्ष घेतलेली रक्कम इथे थेट
// नोंदवायची (जमा रकमेत मिळून) आणि पावतीवर स्वतंत्र छापायची.
export const EXTRA_FIELDS = {
  gharpatti: [
    { key: 'khuli_jaga', label: 'खुली जागा कर' },
    { key: 'notice_fee', label: 'नोटीस फी' },
    { key: 'warrant_fee', label: 'वारंट फी' },
  ],
  panipatti: [
    { key: 'notice_fee', label: 'नोटीस फी' },
    { key: 'other', label: 'इतर' },
  ],
};

export const PAYMENT_MODES = [
  { key: 'cash', label: 'कॅश' },
  { key: 'cheque', label: 'चेक / डी.डी.' },
  { key: 'upi', label: 'UPI' },
];

export function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

// प्रत्यक्ष कागदी नमुना नं. १० पावतीशी जुळणारे शीर्षक + A4 वर एकाच पावती
// क्रमांकाच्या दोन प्रती (एक मालमत्ताधारकास, एक ऑफिस फाईलसाठी) - नमुना ९ क
// (कर मागणी बिल) साठी आधीच वापरलेला .bill-page/.bill-cut-line पॅटर्न.
// hidePrintButton: PaymentReceiptView.jsx सारख्या स्वतंत्र पानावर "बंद करा"
// शेजारी वरच स्वतःचे प्रिंट बटण दाखवायचे असेल तर आतले (खालचे) बटण लपवतो -
// PaymentEntry.jsx वरील मधल्या-पानातील वापरासाठी मात्र आधीप्रमाणेच आतच राहते.
export function ReceiptPrintout({ receipt, property, receiptType, canPrint, hidePrintButton = false }) {
  return (
    <div className="a4-page bill-page">
      <ReceiptCopy receipt={receipt} property={property} receiptType={receiptType} />
      <div className="bill-cut-line" />
      <ReceiptCopy receipt={receipt} property={property} receiptType={receiptType} />
      {canPrint && !hidePrintButton && (
        <div className="no-print" style={{ marginTop: 14 }}>
          <button className="btn secondary" onClick={() => window.print()}>पावती प्रिंट करा</button>
        </div>
      )}
    </div>
  );
}

function ReceiptCopy({ receipt, property, receiptType }) {
  const components = GROUP_COMPONENTS[receiptType];
  const extraFields = EXTRA_FIELDS[receiptType];
  const p = receipt.payment;
  const taxTotal = Number(receipt.amount || 0);
  const extrasTotal = extraFields.reduce((s, f) => s + Number(p[`${f.key}_amount`] || 0), 0);
  const grandTotal = taxTotal + extrasTotal;

  const rows = [
    ...components.map((c) => ({
      label: c.label,
      previous: Number(receipt.coveredByThisReceipt[`previous_${c.key}`] || 0),
      current: Number(receipt.coveredByThisReceipt[`current_${c.key}`] || 0),
    })),
    ...extraFields.map((f) => ({
      label: f.label,
      previous: 0,
      current: Number(p[`${f.key}_amount`] || 0),
    })),
  ];
  const totalPrevious = rows.reduce((s, r) => s + r.previous, 0);
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);
  // सूट/दंड (या पावतीच्या कर-गटातील घटकांसाठी) - देय रकमेत आधीच वजा/समाविष्ट, पावतीवर माहितीसाठी वेगळे
  const sumAdj = (kind, bucket) => components.reduce((t, c) => t + Number(receipt.dues?.[`${kind}_${bucket}_${c.key}`] || 0), 0);
  const discountPrev = sumAdj('discount', 'previous');
  const discountCur = sumAdj('discount', 'current');
  const penaltyPrev = sumAdj('penalty', 'previous');
  const penaltyCur = sumAdj('penalty', 'current');

  return (
    <div className="bill-copy">
      <p style={{ textAlign: 'right', fontSize: 10, margin: 0 }}>ग्रामपंचायत लेखासंहिता-२०११</p>
      <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, margin: '2px 0' }}>ग्रामपंचायत, आनंदनगर</p>
      <p style={{ textAlign: 'center', fontSize: 12, margin: 0 }}>नमुना नं. १० (नियम ३२(५) पहा)</p>
      <div className="bill-head" style={{ marginTop: 6 }}>
        <div className="bill-form-no">पुस्तक क्र. ____</div>
        <div className="bill-title">
          <h3>{RECEIPT_LABELS[receiptType]}</h3>
        </div>
        <div className="bill-meta">No. {p.receipt_no}</div>
      </div>

      <p className="bill-line"><strong>नांव:</strong> {property.owner_name}</p>
      <div className="bill-owner" style={{ fontSize: 12 }}>
        <span><strong>मालमत्ता क्र.:</strong> {property.malmata_no_list}</span>
        <span><strong>आर्थिक वर्ष:</strong> {p.year_label}</span>
      </div>
      <p className="bill-line">सालात {RECEIPT_LABELS[receiptType].replace(' पावती', '')}ची रक्कम मिळाली.</p>

      <table className="bill-table">
        <thead>
          <tr>
            <th>कराचे नांव</th>
            <th className="num">मागील बाकी</th>
            <th className="num">चालू कर</th>
            <th className="num">एकूण कर रुपये</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num">{r.previous.toFixed(2)}</td>
              <td className="num">{r.current.toFixed(2)}</td>
              <td className="num">{(r.previous + r.current).toFixed(2)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td>एकूण</td>
            <td className="num">{totalPrevious.toFixed(2)}</td>
            <td className="num">{totalCurrent.toFixed(2)}</td>
            <td className="num">{grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      {(discountPrev + discountCur > 0 || penaltyPrev + penaltyCur > 0) && (
        <table className="bill-table" style={{ fontSize: 11 }}>
          <tbody>
            {discountPrev + discountCur > 0 && (
              <tr>
                <td>वरील देय रकमेत सूट वजा केली</td>
                <td className="num">{discountPrev.toFixed(2)}</td>
                <td className="num">{discountCur.toFixed(2)}</td>
                <td className="num">{(discountPrev + discountCur).toFixed(2)}</td>
              </tr>
            )}
            {penaltyPrev + penaltyCur > 0 && (
              <tr>
                <td>वरील देय रकमेत दंड समाविष्ट</td>
                <td className="num">{penaltyPrev.toFixed(2)}</td>
                <td className="num">{penaltyCur.toFixed(2)}</td>
                <td className="num">{(penaltyPrev + penaltyCur).toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <p className="bill-line"><strong>अक्षरी रु.:</strong> {amountToMarathiWords(grandTotal)}</p>
      <p className="bill-line">
        <strong>जमा प्रकार:</strong>{' '}
        {PAYMENT_MODES.map((m) => `${p.payment_mode === m.key ? '☑' : '☐'} ${m.label}`).join('   ')}
      </p>
      {p.payment_mode === 'cheque' && (
        <p className="bill-line"><strong>बँकेचे नांव:</strong> {p.bank_name || '-'} &nbsp;&nbsp; <strong>चेक क्र.:</strong> {p.cheque_no || '-'}</p>
      )}

      <div className="bill-sign-row">
        <div>तारीख: {formatDateDMY(p.payment_date)}</div>
        <div>वसुली करणाराची सही</div>
      </div>
    </div>
  );
}
