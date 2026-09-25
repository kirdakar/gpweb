# gpweb ला XAMPP वर चालवून Cloudflare द्वारे वेबवर सुरू करणे

**रचना:** इंटरनेट → Cloudflare → Tunnel (`cloudflared`) → XAMPP Apache (पोर्ट 8080) → `/api` = Node backend (पोर्ट 4000) → MariaDB (XAMPP).
डेटा तुमच्याच संगणकावर राहतो; Cloudflare फक्त सुरक्षित रस्ता (HTTPS) देते. संगणक व इंटरनेट चालू असेल तेव्हाच वेबसाईट चालेल.

> टीप: XAMPP/MariaDB मध्ये `.ora` फाईल नसते (ती Oracle ची आहे). Apache साठी त्याच कामाची फाईल `.conf` — ती `deploy\gpweb.conf` येथे तयार आहे.

## भाग १ - एकदाच करायची तयारी (XAMPP)

1. **Node.js** (LTS) संगणकावर install असावे (`node -v` तपासा).
2. `backend\.env` मध्ये **मजबूत** मूल्ये ठेवा:
   - `JWT_SECRET=` खूप लांब यादृच्छिक मजकूर (किमान ३२ अक्षरे).
   - `DB_PASSWORD=` (root ला पासवर्ड ठेवा), `NODE_ENV` लागत नाही.
3. **`deploy\gpweb.conf`** ही फाईल `C:\xampp\apache\conf\extra\` मध्ये कॉपी करा.
4. `C:\xampp\apache\conf\httpd.conf` उघडा (Notepad, Administrator म्हणून):
   - खालील ३ ओळींच्या आधीचा `#` काढा (असेल तर):
     ```
     LoadModule proxy_module modules/mod_proxy.so
     LoadModule proxy_http_module modules/mod_proxy_http.so
     LoadModule rewrite_module modules/mod_rewrite.so
     ```
   - सर्वात शेवटी ही ओळ जोडा: `Include conf/extra/gpweb.conf`
5. XAMPP Control Panel मध्ये **Apache** व **MySQL** Start करा (Apache रीस्टार्ट करा). कॉन्फिग चुकले तर Apache Start होणार नाही — Logs बटण पहा.

## भाग २ - अॅप build करून लावणे

1. `deploy\build-and-deploy.bat` वर डबल-क्लिक करा → frontend build होऊन `C:\xampp\htdocs\gpweb` मध्ये जाईल.
2. डेटाबेस तयार नसेल तर एकदा: `cd backend` → `npm run migrate:schema`.
3. `deploy\start-gpweb.bat` चालवा (काळी विंडो उघडी राहू द्या) → "gpweb backend listening on http://localhost:4000".
4. ब्राउझरमध्ये तपासा: **http://localhost:8080** → लॉगिन पान दिसले पाहिजे.

पुढे संगणक चालू झाल्यावर आपोआप सुरू व्हायला: Windows **Task Scheduler** → Create Task → Trigger "At log on" → Action `deploy\start-gpweb.bat`. XAMPP Apache/MySQL ला Control Panel मध्ये "Service" म्हणून install करा (हिरवी X वर क्लिक).

## भाग ३ - Cloudflare Tunnel

**आधी:** Cloudflare खाते (मोफत) व त्यात तुमचे डोमेन असावे (नसल्यास खाली "डोमेनशिवाय तात्पुरते" पहा).

1. cloudflared install (PowerShell): `winget install --id Cloudflare.cloudflared`
2. लॉगिन: `cloudflared tunnel login` → ब्राउझरमध्ये डोमेन निवडा.
3. Tunnel तयार करा: `cloudflared tunnel create gpweb` (यातून `<TUNNEL-ID>.json` फाईल तयार होते).
4. `deploy\cloudflared-config.example.yml` `C:\Users\<तुमचे नाव>\.cloudflared\config.yml` म्हणून कॉपी करून `<...>` जागा भरा.
5. DNS जोडा: `cloudflared tunnel route dns gpweb gp.तुमचेडोमेन.com`
6. चाचणी: `cloudflared tunnel run gpweb` → **https://gp.तुमचेडोमेन.com** उघडा.
7. कायमचे (संगणक चालू होताच): `cloudflared service install`

**डोमेनशिवाय तात्पुरते (डेमो/चाचणी):** `cloudflared tunnel --url http://localhost:8080` → `https://xxxx.trycloudflare.com` अशी तात्पुरती लिंक मिळते (बंद केल्यावर बदलते).

## भाग ४ - सुरक्षा (वेबवर टाकण्यापूर्वी आवश्यक)

1. **admin पासवर्ड बदला** (`admin/admin123` डीफॉल्ट आहे) — युजर मास्टरमधून; सर्व वापरकर्त्यांना स्वतंत्र लॉगिन व अधिकार द्या.
2. `JWT_SECRET` बदलल्यावर backend रीस्टार्ट करा (सर्वजण पुन्हा लॉगिन करतील).
3. **Cloudflare Access** (Zero Trust → Access → Applications → Self-hosted, मोफत ५० युजरपर्यंत): तुमच्या वेबसाईटसमोर ईमेल-OTP लॉगिन लावा — अॅपच्या लॉगिनच्या आधी दुसरा दरवाजा.
4. MySQL चा पोर्ट 3306 इंटरनेटला उघडू नका (राउटरवर कोणताही पोर्ट फॉरवर्ड करायचा नाही — Tunnel ला त्याची गरज नाही).
5. **रोज बॅकअप:** अॅपमधील इतर सुविधा → बॅकअप वापरा, आणि फाईल दुसऱ्या ड्राईव्ह/क्लाऊडवर ठेवा.

## बदल केल्यानंतर अद्ययावत करणे
कोड बदलल्यावर: `build-and-deploy.bat` पुन्हा चालवा → `start-gpweb.bat` ची विंडो बंद करून पुन्हा सुरू करा.

## अडचणी
| लक्षण | उपाय |
|---|---|
| Apache Start होत नाही | `httpd.conf` मधील `Include`/`LoadModule` ओळी तपासा; पोर्ट 8080 दुसरे कोणी वापरत नाही ना |
| पान दिसते पण लॉगिन/डेटा येत नाही | `start-gpweb.bat` चालू आहे का; http://localhost:4000/api/health `{"ok":true}` देतो का |
| /login थेट उघडल्यावर 404 | `mod_rewrite` सुरू केलेले नाही |
| 502 Bad Gateway (Cloudflare) | Apache (8080) बंद आहे किंवा config.yml मधील `service` चुकीची |
