@echo off
REM gpweb Node backend सुरू करतो (पोर्ट 4000). ही विंडो बंद करू नका.
REM संगणक चालू झाल्यावर आपोआप सुरू व्हावे यासाठी Task Scheduler मध्ये "At log on" म्हणून ही फाईल जोडा.
cd /d "%~dp0..\backend"
set NODE_ENV=production
node server.js
pause
