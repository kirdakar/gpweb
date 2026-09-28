# gpweb - पार्टीच्या मशिनवर इन्स्टॉल (सोर्स कोडशिवाय)

हा संपूर्ण फोल्डर पार्टीच्या संगणकावर कुठेही कॉपी करा (उदा. `D:\gpweb-app`). यात कोणत्याही
`.js`/`.jsx` सोर्स फाईल्स नाहीत — फक्त चालणारी `gpweb-backend.exe`, तयार झालेले वेबपान
(`public\`), आणि सेटिंग्ज (`.env`).

## आधी लागणारे (एकदाच)
**MySQL/MariaDB हवे** — यासाठी XAMPP सर्वात सोपे:
1. https://www.apachefriends.org वरून XAMPP डाउनलोड करून इन्स्टॉल करा.
2. XAMPP Control Panel उघडून फक्त **MySQL** समोरचे **Start** दाबा.
   **Apache सुरू करण्याची गरज नाही** — gpweb चा स्वतःचा सर्व्हर (`gpweb-backend.exe`) आहे.

## पहिल्यांदाच करायचे
1. `.env` फाईल Notepad ने उघडा. `DB_PASSWORD=` समोर तुमच्या MySQL च्या root पासवर्डाप्रमाणे भरा
   (XAMPP डीफॉल्टमध्ये तो रिकामाच असतो, बदलण्याची गरज नाही). `JWT_SECRET=` समोरचा मजकूर
   एकदा बदलून टाका (कोणतेही लांब यादृच्छिक अक्षरांचे वाक्य).
2. **`migrate-database.bat`** वर डबल-क्लिक करा — डेटाबेस व टेबल्स तयार होतात, आणि सुरुवातीचा
   वापरकर्ता तयार होतो: वापरकर्तानाव `admin`, पासवर्ड `admin123`.
3. **`start-server.bat`** वर डबल-क्लिक करा — काळी विंडो उघडेल, त्यात
   `gpweb backend listening on http://localhost:4000` असे दिसेल. **ही विंडो उघडी ठेवा.**
4. ब्राउझरमध्ये उघडा: **http://localhost:4000** — लॉगिन पान दिसेल.
5. लॉगिन करून लगेच **युजर मास्टर** मधून admin चा पासवर्ड बदला.

## ऑफलाइन वापर (त्याच कार्यालयातील इतर संगणक/मोबाईलवरून, इंटरनेटशिवाय)
1. जिथे `start-server.bat` चालू आहे त्या संगणकाचा स्थानिक IP पत्ता शोधा:
   Command Prompt मध्ये `ipconfig` चालवा — "IPv4 Address" समोरचा आकडा (उदा. `192.168.1.25`).
2. त्याच WiFi/नेटवर्कवरील इतर कोणत्याही संगणक/मोबाईलवरून उघडा: `http://192.168.1.25:4000`
3. पहिल्यांदा Windows Firewall एक पॉप-अप विचारेल ("Allow access") — **Allow** दाबा
   (Private networks साठी). न दिसल्यास: Control Panel → Windows Defender Firewall →
   Allow an app → `gpweb-backend.exe` शोधून Private ला टिक करा.

## ऑनलाइन वापर (इंटरनेटवरून, दुसऱ्या गावातून/घरातून)
पर्यायी — फक्त हवे असल्यास. `D:\gpweb\deploy\DEPLOY_CLOUDFLARE.md` मधील "Cloudflare Tunnel"
पद्धत वापरा, फक्त तिथे `service: http://localhost:8090` ऐवजी **`http://localhost:4000`**
लिहा (कारण इथे वेगळा Apache नाही, gpweb स्वतःच 4000 वर चालते).

## संगणक चालू होताच आपोआप सुरू होण्यासाठी (कायमचे)
1. Windows **Task Scheduler** उघडा → **Create Task**.
2. General: नाव `gpweb`, **"Run whether user is logged on or not"** निवडा.
3. Triggers → New → **At startup**.
4. Actions → New → Program/script मध्ये या फोल्डरमधील `start-server.bat` चा पूर्ण पत्ता द्या.
5. OK दाबून तुमचा Windows पासवर्ड टाका.
(XAMPP च्या MySQL लाही Control Panel मधील "Svc" चौकोन टिक करून Service करा, म्हणजे तेही
आपोआप सुरू होईल.)

## अडचणी
| लक्षण | उपाय |
|---|---|
| `start-server.bat` लगेच बंद होते / एरर | MySQL (XAMPP) चालू आहे का पाहा; `.env` मधील DB_PASSWORD बरोबर आहे का तपासा |
| पान दिसतच नाही | `http://localhost:4000/api/health` उघडून `{"ok":true}` येते का पाहा |
| दुसऱ्या संगणकावरून उघडत नाही | Windows Firewall मध्ये `gpweb-backend.exe` ला परवानगी द्या (वर पहा) |
| डेटा हरवला/पुन्हा रिकामे दिसते | चुकीचा DB_NAME/वेगळा MySQL वापरला जात आहे का `.env` मध्ये तपासा |
