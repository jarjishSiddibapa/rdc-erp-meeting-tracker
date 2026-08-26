@echo off
setlocal EnableExtensions

REM Production entry point. Keep Node in the foreground so Windows Task Scheduler
REM can monitor the real process and apply its restart-on-failure policy.
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available on PATH.
  exit /b 1
)

if not exist "backend\.env" (
  echo ERROR: backend\.env is missing. Copy backend\.env.example and configure it first.
  exit /b 1
)

if not exist "backend\node_modules\express\package.json" (
  echo ERROR: Backend dependencies are missing. Run build.bat first.
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo ERROR: The production frontend is missing. Run build.bat first.
  exit /b 1
)

cd /d "%PROJECT_ROOT%backend"
echo Starting RDC ERP Meeting Tracker on port 777...
node server.js
set "APP_EXIT_CODE=%ERRORLEVEL%"

echo RDC ERP Meeting Tracker stopped with exit code %APP_EXIT_CODE%.
exit /b %APP_EXIT_CODE%
