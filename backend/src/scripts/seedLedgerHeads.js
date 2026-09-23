// नमुना १ (वार्षिक अंदाजपत्रक) मधील जमा/खर्च शीर्षांचा स्थिर वृक्ष एकदाच
// भरतो - ग्रामपंचायत लेखा संहिता, २०११ (PDF) मधून जसाच्या तसा उतरवलेला.
// पुन्हा चालवला तरी सुरक्षित (code वर ON DUPLICATE KEY UPDATE).
//
// Usage: node src/scripts/seedLedgerHeads.js
require('dotenv').config();
const pool = require('../config/db');

// प्रत्येक top-level गटाखाली एकतर थेट leaf items (सोपी सूची), किंवा
// अ/ब/क असे उप-गट (नेस्टेड) - नमुना १ मध्ये दोन्ही प्रकार आहेत.
const JAMA = [
  {
    code: '1', name: 'ग्राम निधी जमा', children: [
      {
        code: '1.a', name: '(एक) (अ) कर', items: [
          'मालमत्ता कर, जमिनी व इमारती यावरील कर', 'दिवाबत्ती कर', 'स्वच्छता कर',
          'दुकाने, लघु उद्योग व हॉटेल चालविणे यावरील कर', 'यात्रा कर', 'जत्रा, उत्सव व इतर मनोरंजन कर',
          'सायकल व इतर वाहनांवरील कर', 'टोल टॅक्स', 'उतारू व मालावरील कर', 'वन विकास कर',
          'सेवा कर', 'व्यापारी किंवा आजीविकायावरील कर (शेतीव्यतिरिक्त)',
          'गुरांच्या बाजारातील दलालीचा व्यवसाय व आजीविकेवरील कर', 'इतर कर',
        ],
      },
      {
        code: '1.b', name: '(एक) (ब) करेतर उत्पन्न', items: [
          'बाजार फी', 'टांगा स्टॅण्ड फी', 'कार स्टॅण्ड फी', 'पाणीपट्टी', 'स्वच्छता फी', 'गाय चरण फी',
          'डीव्हीडीएफ व्याज २.५ टक्के', 'जमीन भाडेपट्टी', 'व्याज जमा', 'जागा भाडे', 'कोंडवाडा जमा',
          'देणगी', 'इतर जमा',
        ],
      },
      {
        code: '1.c', name: '(एक) (क) अभिहस्तांकित रकमा', items: [
          'मुद्रांक शुल्क', 'उपकर', 'जमीन महसूल', 'जमीन समानीकरण', 'गौण खनिजे',
          'पथ दिवाबत्ती देयकाचा भरणा करण्यासाठी अनुदान', 'नळपाणी पुरवठ्यातील देयकासाठी ५० टक्के अनुदाने',
          'मागास व आदिवासी क्षेत्रासाठी साहाय्य', 'यात्राकराऐवजी अनुदाने', 'जकात नुकसानभरपाई अनुदाने', 'इतर अनुदाने',
        ],
      },
    ],
  },
  {
    code: '2', name: 'राज्य शासन सहायक अनुदाने जमा', children: [
      {
        code: '2.a', name: '(दोन) (अ) राज्य शासन सहायक अनुदाने जमा', items: [
          'शौचालय', 'दलित वस्ती सुधार', 'पाणीपुरवठा/टी.सी.एल.', 'बांधकाम', 'शिक्षण शाळा',
          'मानधन, किमान वेतन व बैठक भत्ता', 'आरोग्य', 'इतर',
        ],
      },
      {
        code: '2.b', name: '(दोन) (ब) आमदार, खासदार, डोंगरी विकास कार्यक्रमांतर्गत जि.ग्रा.वि. यंत्रणेकडून आलेला निधी इ.', items: null,
      },
    ],
  },
  {
    code: '3', name: 'केंद्र शासन अनुदाने जमा', items: ['स्वर्णजयंती ग्राम स्वरोजगार योजना', 'जवाहर ग्राम समृद्ध योजना', 'इतर'],
  },
  {
    code: '4', name: 'संकीर्ण जमा', items: ['अनामत/प्रतिभूती', 'ठेवी', 'कर्जे', 'इतर'],
  },
  {
    code: '5', name: 'प्रारंभीची शिल्लक (अनामत/ठेवी/कर्जे)', items: ['अनामत/प्रतिभूती', 'ठेवी', 'कर्जे', 'इतर'],
  },
  {
    code: '6', name: 'प्रारंभीची शिल्लक (निधी खाती)', items: ['जवाहर ग्राम समृद्धी योजना', 'ग्राम पाणीपुरवठा निधी खाते', 'ग्रामपंचायत निधी खाते', 'इतर'],
  },
];

const KHARCH = [
  {
    code: 'K1', name: 'ग्राम निधीतून खर्च', items: [
      'सरपंच मानधन', 'सदस्य बैठक भत्ता', 'सदस्य/सरपंच प्रवास भत्ता', 'कर्मचारी वेतन', 'कर्मचारी प्रवास भत्ता',
      'कार्यालयीन खर्च', 'दुरुस्ती व देखभाल', 'स्वच्छता', 'पाणीपुरवठा',
      'वीज देयके (अ) पाणीपुरवठा', 'वीज देयके (ब) रस्त्यावरील दिवाबत्ती',
      'पथ दिवाबत्ती, साहित्य व इतर', 'शिक्षण', 'आरोग्य', 'रस्ते व गटार', 'अन्य बांधकाम',
      'वाचनालय', 'जलशुद्धीकरण/टी.सी.एल.', 'बाग व मैदान', 'समाजकल्याण (आदिवासी व मागासवर्ग)',
      'डी.व्ही.डी.एफ. वर्गणी', 'महिला व बालकल्याण', 'सामाजिक व सांस्कृतिक कार्यक्रम',
      'कोंडवाडा', 'साहित्य खरेदी', 'शेती', 'इतर',
    ],
  },
  {
    code: 'K2', name: 'राज्य शासन सहायक अनुदाने व खर्च', items: [
      'शौचालय', 'दलित वस्ती सुधार', 'पाणीपुरवठा/टी.सी.एल.', 'बांधकाम', 'शिक्षण शाळा',
      'मानधन, किमान वेतन व बैठक भत्ता', 'आरोग्य', 'इतर',
    ],
  },
  {
    code: 'K3', name: 'केंद्र शासन अनुदाने व खर्च', items: ['स्वर्णजयंती रोजगार योजना', 'जवाहर ग्राम समृद्धी योजना', 'इतर'],
  },
  {
    code: 'K4', name: 'संकीर्ण खर्च', items: ['अग्रिम/अनामत', 'ठेवी', 'कर्जे, हप्ता व व्याज प्रदाने', 'इतर'],
  },
  {
    code: 'K5', name: 'अखेरची शिल्लक (अनामत/ठेवी/कर्जे)', items: ['अनामत', 'ठेवी', 'कर्जे', 'इतर'],
  },
  {
    code: 'K6', name: 'अखेरची शिल्लक (निधी खाती)', items: ['जवाहर ग्राम समृद्धी योजना', 'पंचायत निधी खाते', 'ग्राम पाणीपुरवठा निधी', 'इतर'],
  },
];

async function upsertHead(conn, { code, group_type, parent_id, name, sort_order, is_leaf }) {
  await conn.query(
    `INSERT INTO ledger_heads (code, group_type, parent_id, name, sort_order, is_leaf)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE group_type = VALUES(group_type), parent_id = VALUES(parent_id),
       name = VALUES(name), sort_order = VALUES(sort_order), is_leaf = VALUES(is_leaf)`,
    [code, group_type, parent_id, name, sort_order, is_leaf]
  );
  const [[row]] = await conn.query('SELECT id FROM ledger_heads WHERE code = ?', [code]);
  return row.id;
}

async function seedGroup(conn, groupType, groups) {
  let topSort = 0;
  for (const g of groups) {
    topSort++;
    const groupId = await upsertHead(conn, {
      code: g.code, group_type: groupType, parent_id: null, name: g.name, sort_order: topSort, is_leaf: 0,
    });

    if (g.children) {
      let subSort = 0;
      for (const sub of g.children) {
        subSort++;
        const subId = await upsertHead(conn, {
          code: sub.code, group_type: groupType, parent_id: groupId, name: sub.name, sort_order: subSort,
          is_leaf: sub.items ? 0 : 1,
        });
        if (sub.items) {
          let itemSort = 0;
          for (const itemName of sub.items) {
            itemSort++;
            await upsertHead(conn, {
              code: `${sub.code}.${itemSort}`, group_type: groupType, parent_id: subId, name: itemName,
              sort_order: itemSort, is_leaf: 1,
            });
          }
        }
      }
    } else if (g.items) {
      let itemSort = 0;
      for (const itemName of g.items) {
        itemSort++;
        await upsertHead(conn, {
          code: `${g.code}.${itemSort}`, group_type: groupType, parent_id: groupId, name: itemName,
          sort_order: itemSort, is_leaf: 1,
        });
      }
    }
  }
}

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await seedGroup(conn, 'जमा', JAMA);
    await seedGroup(conn, 'खर्च', KHARCH);
    await conn.commit();
    const [[count]] = await conn.query('SELECT COUNT(*) AS c FROM ledger_heads');
    console.log(`ledger_heads seeded/updated. Total rows: ${count.c}`);
  } catch (err) {
    await conn.rollback();
    console.error('Seeding failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
