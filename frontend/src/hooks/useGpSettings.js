import { useEffect, useState } from 'react';
import client from '../api/client';

// ग्रामपंचायतीचे नाव/तालुका/जिल्हा (सेटिंग्ज स्क्रीन) - सर्व छापील
// अहवालांच्या शीर्षकात एकसारखे दाखवण्यासाठी एकाच जागी आणतो, प्रत्येक
// रिपोर्टमध्ये तोच fetch + जोडणी पुन्हा न लिहिता.
export default function useGpSettings() {
  const [settings, setSettings] = useState({ gp_name: '', taluka: '', district: '' });

  useEffect(() => {
    client.get('/settings').then(({ data }) => setSettings(data));
  }, []);

  const gpLine = [settings.gp_name, settings.taluka ? `ता. ${settings.taluka}` : '', settings.district ? `जि. ${settings.district}` : '']
    .filter(Boolean).join(' ') || '(ग्रामपंचायतीचे नाव सेटिंग्जमध्ये नोंदवा)';

  return { settings, gpLine };
}
