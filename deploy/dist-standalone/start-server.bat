@echo off
REM gpweb सर्व्हर सुरू करतो. ही विंडो उघडी ठेवा - बंद केली की अॅप बंद होते.
cd /d "%~dp0"
gpweb-backend.exe
pause
