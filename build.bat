@echo off
REM Run this after changing frontend code, then restart start-all.bat (or the
REM Windows service / Task Scheduler task) to pick up the new build.
echo Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
echo Building frontend...
call npm run build
echo.
echo Installing backend dependencies...
cd /d "%~dp0backend"
call npm install
echo.
echo Build complete. Start (or restart) the app with start-all.bat.
pause
