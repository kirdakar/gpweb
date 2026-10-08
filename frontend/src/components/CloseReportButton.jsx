import { useLocation, useNavigate } from 'react-router-dom';
import { getRememberedMenu, REOPEN_MENU_EVENT } from '../utils/menuMemory';

// "बंद करा" - जिथून हे पान उघडले तिथेच परत जातो (उदा. दैनिक रोकड वहीतील
// "अलीकडील नोंदी" मधून पावती/प्रमाणक/परतावा आदेश उघडले असेल तर बंद
// केल्यावर तीच डेटा भरणे स्क्रीन परत यावी, नेहमी मुख्य डॅशबोर्डवर नाही).
// थेट URL टाकून किंवा रिफ्रेश करून उघडलेल्या पानावर अ‍ॅपमध्ये मागे जाण्यासारखे
// काहीच नसते (history.state.idx = 0) - अशा वेळी डॅशबोर्डवर जातो.
// हे पान वरच्या मेनूतून (उदा. रिपोर्ट > नमुना ५) उघडले असेल तर बंद केल्यावर तोच मेनू व उपमेनू
// पुन्हा उघडतो (Layout.jsx ऐकतो) - त्यामुळे दुसरा रिपोर्ट थेट निवडता येतो.
export default function CloseReportButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function close() {
    const mem = getRememberedMenu(pathname);
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
    if (mem) {
      setTimeout(() => window.dispatchEvent(new CustomEvent(REOPEN_MENU_EVENT, { detail: mem })), 60);
    }
  }

  return <button type="button" className="btn secondary" onClick={close}>बंद करा</button>;
}
