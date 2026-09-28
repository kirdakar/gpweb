// पॅकेज केलेल्या (.exe, pkg) आवृत्तीत __dirname हा pkg च्या आभासी स्नॅपशॉटमध्ये असतो;
// .env / public / schema.sql सारख्या .exe शेजारील खऱ्या फाईल्स वाचण्यासाठी लागणारा खरा
// फोल्डर हे फंक्शन ठरवते. विकासादरम्यान (`node server.js`) तो नेहमीचा backend/ फोल्डर असतो -
// त्यामुळे सध्याचा XAMPP/dev वापर यामुळे बदलत नाही (फक्त पॅकेज केलेल्या .exe साठी नवीन मार्ग).
const path = require('path');

function getBaseDir() {
  if (typeof process.pkg !== 'undefined') return path.dirname(process.execPath);
  return path.join(__dirname, '..', '..'); // src/utils -> backend/
}

module.exports = { getBaseDir };
