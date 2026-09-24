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
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}
export default fmtDate;
