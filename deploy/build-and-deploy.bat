@echo off
REM gpweb: frontend build करून XAMPP htdocs मध्ये कॉपी करतो.
REM कोणताही बदल केल्यानंतर हीच फाईल पुन्हा चालवा.
setlocal
set "PROJECT=%~dp0.."
set "TARGET=C:\xampp\htdocs\gpweb"

echo [1/3] Frontend build...
pushd "%PROJECT%\frontend"
call npm install
call npm run build
if errorlevel 1 ( echo BUILD FAILED & popd & pause & exit /b 1 )
popd

echo [2/3] htdocs मध्ये कॉपी...
if not exist "%TARGET%" mkdir "%TARGET%"
robocopy "%PROJECT%\frontend\dist" "%TARGET%" /MIR /NFL /NDL /NJH /NJS >nul

echo [3/3] Backend dependencies...
pushd "%PROJECT%\backend"
call npm install --omit=dev
popd

echo पूर्ण. आता start-gpweb.bat चालवा आणि XAMPP मध्ये Apache व MySQL Start करा.
pause
