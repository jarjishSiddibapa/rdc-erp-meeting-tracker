@echo off
echo Starting frontend dev server (hot reload, proxies /api to backend on :777)...
echo For normal LAN use, just run start-all.bat instead — this is for frontend development only.
cd /d "%~dp0frontend"
npm run dev
pause
