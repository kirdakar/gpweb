@echo off
REM फक्त पहिल्यांदाच चालवा - डेटाबेस व टेबल्स तयार करतो, सुरुवातीची आर्थिक वर्षे व
REM admin वापरकर्ता (admin / admin123) बनवतो. पुन्हा चालवले तरी सुरक्षित (डेटा मिटत नाही).
REM आधी XAMPP/MySQL चालू असल्याची खात्री करा.
cd /d "%~dp0"
gpweb-backend.exe --migrate
pause
