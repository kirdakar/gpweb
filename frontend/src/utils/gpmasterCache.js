import client from '../api/client';

// मिळकतदार मास्टर (GPMASTER) ची संपूर्ण यादी (~900+ नोंदी) "नवीन मिळकत
// नोंद" स्क्रीन उघडताना कोड/नाव शोध-कंबोसाठी लागते. आधी हे प्रत्येक वेळी
// (प्रत्येक नवीन नोंद भरताना) पुन्हा नव्याने आणले जात होते - याच सत्रात
// थोड्याच वेळापूर्वी आणलेली तीच यादी पुन्हा मागवली जात असे. आता एकदा
// आणल्यावर सत्रभर (module-level) साठवतो; GPMASTER मास्टर स्क्रीनवर
// बदल (जोड/संपादन/मिटवणे) झाल्यावरच invalidate करून पुढच्या वेळी ताजी आणतो.
let cache = null;
let inflight = null;

export function fetchGpmasterList() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = client.get('/gpmaster').then(({ data }) => {
      cache = data;
      inflight = null;
      return data;
    }).catch((err) => { inflight = null; throw err; });
  }
  return inflight;
}

export function invalidateGpmasterCache() {
  cache = null;
}
