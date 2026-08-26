@echo off
REM Starts the ERP Meeting Tracker backend, which also serves the already-built
REM frontend, on port 777 (LAN accessible). Does NOT rebuild the frontend — run
REM build.bat after you change frontend code. Safe to use as a Task Scheduler
REM "run at startup" action for automatic recovery after a PC restart/crash.
cd /d "%~dp0backend"
node server.js
pause
