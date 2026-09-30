import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';

// ग्रामपंचायतीचे नाव/तालुका/जिल्हा - आधी प्रत्येक रिपोर्ट/स्क्रीनचा स्वतःचा
// hook (useGpSettings) प्रत्येक वेळी वेगळा GET /settings करत होता, त्यामुळे
// प्रत्येक पान बदलताना एक जादा राउंड-ट्रिप (संथ इंटरनेट/Cloudflare Tunnel वर
// जाणवण्याइतपत) लागत असे. आता एकदाच (लॉगिन सत्रात) आणून सर्वत्र वाटतो -
// सेटिंग्ज स्क्रीनवर बदल जतन केल्यावर refresh() ने ताजे करता येते.
const GpSettingsContext = createContext(null);

export function GpSettingsProvider({ children }) {
  const [settings, setSettings] = useState({ gp_name: '', taluka: '', district: '' });

  const refresh = useCallback(() => {
    client.get('/settings').then(({ data }) => setSettings(data));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const gpLine = [settings.gp_name, settings.taluka ? `ता. ${settings.taluka}` : '', settings.district ? `जि. ${settings.district}` : '']
    .filter(Boolean).join(' ') || '(ग्रामपंचायतीचे नाव सेटिंग्जमध्ये नोंदवा)';

  return (
    <GpSettingsContext.Provider value={{ settings, gpLine, refresh }}>
      {children}
    </GpSettingsContext.Provider>
  );
}

export function useGpSettingsContext() {
  const ctx = useContext(GpSettingsContext);
  if (!ctx) throw new Error('useGpSettingsContext must be used within GpSettingsProvider');
  return ctx;
}
