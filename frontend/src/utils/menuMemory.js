// मेनूतून (मास्टर/दैनिक व्यवहार/रिपोर्ट > उपमेनू) उघडलेले शेवटचे पान आठवते. "बंद करा" दाबल्यावर तेच मेनू (व तो उपमेनू)
// पुन्हा उघडून दाखवण्यासाठी - म्हणजे दुसरा रिपोर्ट पाहायला पुन्हा मेनू > उपमेनू शोधावा लागत नाही.
let last = null; // { to, menu, submenu }

export function rememberMenu(to, menu, submenu = null) {
  last = { to, menu, submenu };
}

// फक्त सध्याचे पान तेच असेल जे मेनूतून उघडले होते तरच (दुसऱ्या पानातून/बटणातून उघडलेल्या पावती-प्रमाणकासाठी नाही).
export function getRememberedMenu(pathname) {
  return last && last.to === pathname ? last : null;
}

export const REOPEN_MENU_EVENT = 'gp-reopen-menu';
