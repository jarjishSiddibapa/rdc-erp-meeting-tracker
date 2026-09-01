@echo off
setlocal EnableExtensions

REM Double-click/manual mode pauses before closing so errors stay visible.
REM Task Scheduler must pass --scheduled so failures exit immediately and its
REM restart-on-failure policy can restart the application.
set "PROJECT_ROOT=%~dp0"
set "SCHEDULED_MODE=0"
if /I "%~1"=="--scheduled" set "SCHEDULED_MODE=1"
set "STARTUP_LOG=%PROJECT_ROOT%production-startup.log"
cd /d "%PROJECT_ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  set "FAILURE_MESSAGE=Node.js is not installed or is not available on PATH."
  goto :fail
)

if not exist "backend\.env" (
  set "FAILURE_MESSAGE=backend\.env is missing. Copy backend\.env.example and configure it first."
  goto :fail
)

if not exist "backend\node_modules\express\package.json" (
  set "FAILURE_MESSAGE=Backend dependencies are missing. Run build.bat first."
  goto :fail
)

if not exist "frontend\dist\index.html" (
  set "FAILURE_MESSAGE=The production frontend is missing. Run build.bat first."
  goto :fail
)

cd /d "%PROJECT_ROOT%backend"
echo Starting RDC ERP Meeting Tracker on port 777...
>> "%STARTUP_LOG%" echo [%date% %time%] Starting application.

set "NODE_ENV=production"
node server.js
set "APP_EXIT_CODE=%ERRORLEVEL%"

echo.
echo RDC ERP Meeting Tracker stopped with exit code %APP_EXIT_CODE%.
>> "%STARTUP_LOG%" echo [%date% %time%] Application stopped with exit code %APP_EXIT_CODE%.
call :pause_if_manual
exit /b %APP_EXIT_CODE%

:fail
echo.
echo ERROR: %FAILURE_MESSAGE%
echo.
>> "%STARTUP_LOG%" echo [%date% %time%] ERROR: %FAILURE_MESSAGE%
call :pause_if_manual
exit /b 1

:pause_if_manual
if "%SCHEDULED_MODE%"=="0" (
  echo Press any key to close this window...
  pause >nul
)
exit /b 0
