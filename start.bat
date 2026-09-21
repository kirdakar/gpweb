@echo off
setlocal

echo ================================================
echo   ग्रामपंचायत मिळकत कर - सर्व्हर सुरू करत आहे
echo ================================================
echo.

REM --- 1. MySQL (XAMPP) आधीच चालू नसेल तरच सुरू करा ---
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I "mysqld.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [1/3] MySQL आधीच सुरू आहे.
) else (
    echo [1/3] MySQL सुरू करत आहे...
    start "MySQL (XAMPP)" "C:\xampp\mysql_start.bat"
    timeout /t 5 /nobreak >NUL
)

REM --- 2. Backend (Node/Express, http://localhost:4000) ---
echo [2/3] Backend सुरू करत आहे...
start "GP Backend - localhost:4000" cmd /k "cd /d D:\gpweb\backend && node --watch-path=src --watch-path=server.js server.js"

REM --- 3. Frontend (Vite dev server, http://localhost:5173) ---
echo [3/3] Frontend सुरू करत आहे...
start "GP Frontend - localhost:5173" cmd /k "cd /d D:\gpweb\frontend && npm run dev"

REM --- 4. Frontend तयार होण्यासाठी थोडा वेळ थांबून ब्राउझर उघडा ---
echo.
echo ब्राउझर उघडण्यासाठी थोडा वेळ थांबत आहे...
timeout /t 8 /nobreak >NUL
start "" "http://localhost:5173"

echo.
echo सर्व सुरू झाले. Backend/Frontend त्यांच्या स्वतंत्र विंडोमध्ये चालू आहेत -
echo त्या विंडो बंद केल्यास तो सर्व्हर थांबेल. ही विंडो बंद करू शकता.
echo.
pause
endlocal
