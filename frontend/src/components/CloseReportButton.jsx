import { useNavigate } from 'react-router-dom';

// "बंद करा" - जिथून हे पान उघडले तिथेच परत जातो (उदा. दैनिक रोकड वहीतील
// "अलीकडील नोंदी" मधून पावती/प्रमाणक/परतावा आदेश उघडले असेल तर बंद
// केल्यावर तीच डेटा भरणे स्क्रीन परत यावी, नेहमी मुख्य डॅशबोर्डवर नाही).
// थेट URL टाकून किंवा रिफ्रेश करून उघडलेल्या पानावर अ‍ॅपमध्ये मागे जाण्यासारखे
// काहीच नसते (history.state.idx = 0) - अशा वेळी डॅशबोर्डवर जातो.
export default function CloseReportButton() {
  const navigate = useNavigate();

  function close() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }

  return <button type="button" className="btn secondary" onClick={close}>बंद करा</button>;
}
