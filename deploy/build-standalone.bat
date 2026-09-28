@echo off
REM gpweb - पार्टीच्या मशिनवर सोर्स कोडशिवाय देण्यासाठी "स्टँडअलोन" पॅकेज तयार करतो.
REM निकाल: deploy\dist-standalone\  (हाच पूर्ण फोल्डर पार्टीला द्यायचा - .js सोर्स फाईल्स नसतात,
REM फक्त gpweb-backend.exe + public\ (build झालेले frontend) + schema.sql + सूचना).
setlocal
set "PROJECT=%~dp0.."
set "OUT=%~dp0dist-standalone"

echo [1/4] Frontend build...
pushd "%PROJECT%\frontend"
call npm install
call npm run build
if errorlevel 1 ( echo BUILD FAILED & popd & pause & exit /b 1 )
popd

echo [2/4] Backend .exe तयार करत आहे (पहिल्या वेळी Node runtime डाउनलोड होतो, वेळ लागू शकतो)...
pushd "%PROJECT%\backend"
call npm install
call npx @yao-pkg/pkg server.js --targets node22-win-x64 --output "%OUT%\gpweb-backend.exe"
if errorlevel 1 ( echo BUILD FAILED & popd & pause & exit /b 1 )
popd

echo [3/4] frontend build व schema.sql कॉपी करत आहे...
if exist "%OUT%\public" rmdir /s /q "%OUT%\public"
robocopy "%PROJECT%\frontend\dist" "%OUT%\public" /MIR /NFL /NDL /NJH /NJS >nul
copy /y "%PROJECT%\backend\src\sql\schema.sql" "%OUT%\schema.sql" >nul

echo [4/4] .env व पार्टी-सूचना तयार करत आहे...
if not exist "%OUT%\.env" (
  > "%OUT%\.env" echo PORT=4000
  >> "%OUT%\.env" echo DB_HOST=localhost
  >> "%OUT%\.env" echo DB_PORT=3306
  >> "%OUT%\.env" echo DB_USER=root
  >> "%OUT%\.env" echo DB_PASSWORD=
  >> "%OUT%\.env" echo DB_NAME=gpweb
  >> "%OUT%\.env" echo JWT_SECRET=badla-ha-shabd-lamb-yadrucchik-akshare-takaa
  >> "%OUT%\.env" echo JWT_EXPIRES_IN=8h
  >> "%OUT%\.env" echo ADMIN_USERNAME=admin
  >> "%OUT%\.env" echo ADMIN_PASSWORD=admin123
)

echo.
echo पूर्ण. "%OUT%" हा संपूर्ण फोल्डर पार्टीच्या मशिनवर कॉपी करा (USB/पेनड्राईव्ह/झिप).
echo त्यात README-पार्टी-सूचना.md मधील सूचना पाळा.
pause
