// पावतीवरील "अक्षरी रु." साठी - रक्कम (रुपये.पैसे) मराठी शब्दांत.
// भारतीय अंकपद्धती (कोटी/लाख/हजार/शे) वापरते. १-९९ साठी प्रत्येक आकड्याचा
// स्वतंत्र (न जुळवता येणारा) शब्द असल्याने पूर्ण सूची आवश्यक आहे.
const WORDS = [
  '', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा',
  'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस', 'वीस',
  'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस', 'तीस',
  'एकतीस', 'बत्तीस', 'तेहतीस', 'चौतीस', 'पस्तीस', 'छत्तीस', 'सदतीस', 'अडतीस', 'एकोणचाळीस', 'चाळीस',
  'एक्केचाळीस', 'बेचाळीस', 'त्रेचाळीस', 'चव्वेचाळीस', 'पंचेचाळीस', 'सेहेचाळीस', 'सत्तेचाळीस', 'अठ्ठेचाळीस', 'एकोणपन्नास', 'पन्नास',
  'एक्कावन्न', 'बावन्न', 'त्रेपन्न', 'चोपन्न', 'पंचावन्न', 'छप्पन्न', 'सत्तावन्न', 'अठ्ठावन्न', 'एकोणसाठ', 'साठ',
  'एकसष्ट', 'बासष्ट', 'त्रेसष्ट', 'चौसष्ट', 'पासष्ट', 'सहासष्ट', 'सदुसष्ट', 'अडुसष्ट', 'एकोणसत्तर', 'सत्तर',
  'एक्काहत्तर', 'बहात्तर', 'त्र्याहत्तर', 'चौर्‍याहत्तर', 'पंच्याहत्तर', 'शहात्तर', 'सत्याहत्तर', 'अठ्ठ्याहत्तर', 'एकोणऐंशी', 'ऐंशी',
  'एक्क्याऐंशी', 'ब्याऐंशी', 'त्र्याऐंशी', 'चौऱ्याऐंशी', 'पंच्याऐंशी', 'शहाऐंशी', 'सत्त्याऐंशी', 'अठ्ठ्याऐंशी', 'एकोणनव्वद', 'नव्वद',
  'एक्क्याण्णव', 'ब्याण्णव', 'त्र्याण्णव', 'चौऱ्याण्णव', 'पंच्याण्णव', 'शहाण्णव', 'सत्त्याण्णव', 'अठ्ठ्याण्णव', 'नव्याण्णव',
];

function belowThousandToWords(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundred) parts.push(hundred === 1 ? 'शंभर' : `${WORDS[hundred]}शे`);
  if (rest) parts.push(WORDS[rest]);
  return parts.join(' ');
}

function integerToWords(num) {
  if (num === 0) return 'शून्य';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const rest = num;

  const parts = [];
  if (crore) parts.push(`${belowThousandToWords(crore) || WORDS[crore]} कोटी`);
  if (lakh) parts.push(`${belowThousandToWords(lakh) || WORDS[lakh]} लाख`);
  if (thousand) parts.push(`${belowThousandToWords(thousand) || WORDS[thousand]} हजार`);
  if (rest) parts.push(belowThousandToWords(rest));
  return parts.join(' ');
}

// उदा. 1513.66 -> "एक हजार पाचशे तेरा रुपये सहासष्ट पैसे मात्र"
export function amountToMarathiWords(amount) {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  const rupeeWords = `${integerToWords(rupees)} रुपये`;
  if (paise === 0) return `${rupeeWords} मात्र`;
  return `${rupeeWords} ${integerToWords(paise)} पैसे मात्र`;
}
