@echo off
echo Starting ERP Meeting Tracker backend (serves API + built frontend) on port 777...
cd /d "%~dp0backend"
node server.js
pause
