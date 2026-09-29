import { useEffect } from 'react';

// आधीच उघडलेल्या टॅबवर नवीन build (deploy) आल्यावर वापरकर्त्याने स्वतः Ctrl+F5 करावे
// लागू नये म्हणून - सध्याच्या पानावरील बंडलचा पत्ता व सर्व्हरवरील ताज्या index.html मधील
// बंडलचा पत्ता वेळोवेळी जुळवतो; फरक आढळल्यास पान आपोआप रिफ्रेश करतो. index.html कधीच
// cache होत नसल्याने (server.js/gpweb.conf मधील Cache-Control) हा fetch नेहमी ताजाच येतो.
function currentBundlePath() {
  const s = [...document.scripts].find((el) => el.src && el.src.includes('/assets/'));
  if (!s) return null;
  try { return new URL(s.src, window.location.origin).pathname; } catch { return null; }
}

export default function AutoUpdateChecker() {
  useEffect(() => {
    const mine = currentBundlePath();
    if (!mine) return; // dev सर्व्हरवर (Vite, hashed बंडल नाही) काहीही करत नाही

    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/', { cache: 'no-store' });
        const html = await res.text();
        const m = html.match(/\/assets\/[\w.-]+\.js/);
        if (m && m[0] !== mine) window.location.reload();
      } catch {
        // नेटवर्क अडचण - पुढच्या फेरीत पुन्हा प्रयत्न, आत्ता दुर्लक्ष
      }
    }

    const interval = setInterval(check, 5 * 60 * 1000); // दर ५ मिनिटांनी
    document.addEventListener('visibilitychange', check); // टॅब परत उघडल्यावर लगेच तपासा
    window.addEventListener('focus', check);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return null;
}
