// सर्व रिपोर्ट/स्क्रीनवर दिनांक dd/mm/yyyy स्वरूपात दाखवण्यासाठी. 'YYYY-MM-DD'
// (किंवा 'YYYY-MM-DDTHH:...' ISO) स्ट्रिंग, Date ऑब्जेक्ट किंवा रिकामे मूल्य स्वीकारतो;
// ओळखता न आल्यास मूळ मूल्यच परत करतो. <input type="date"> ला याची गरज नाही.
export function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${String(v.getDate()).padStart(2, '0')}/${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m && m[1] === '0000') return ''; // MySQL ची अवैध शून्य तारीख (0000-00-00) रिकामी समजतो
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}

// <input type="date"> साठी 'YYYY-MM-DD' (dd/mm/yyyy स्वरूप त्या रकान्यात चालत नाही); अवैध/शून्य तारीख असल्यास रिकामे.
export function toDateInput(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
export default fmtDate;
