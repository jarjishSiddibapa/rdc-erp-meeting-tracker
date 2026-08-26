@echo off
setlocal EnableExtensions

REM Manual/double-click mode pauses before closing. update-production.bat passes
REM --no-pause so it can receive this script's exit code without blocking.
set "PROJECT_ROOT=%~dp0"
set "NO_PAUSE=0"
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"
set "BUILD_LOG=%PROJECT_ROOT%production-build.log"
cd /d "%PROJECT_ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  set "FAILURE_MESSAGE=Node.js is not installed or is not available on PATH."
  goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
  set "FAILURE_MESSAGE=npm is not installed or is not available on PATH."
  goto :fail
)

node -e "const [major,minor]=process.versions.node.split('.').map(Number); if(!((major===20&&minor>=19)||(major===22&&minor>=12)||major>22)){console.error('ERROR: Node.js 20.19+ or 22.12+ is required. Current: '+process.version);process.exit(1)}"
if errorlevel 1 (
  set "FAILURE_MESSAGE=The installed Node.js version is not supported."
  goto :fail
)

if not exist "backend\.env" (
  set "FAILURE_MESSAGE=backend\.env is missing. Copy backend\.env.example and configure production values first."
  goto :fail
)

>> "%BUILD_LOG%" echo [%date% %time%] Starting production build.

echo Installing backend dependencies from package-lock.json...
cd /d "%PROJECT_ROOT%backend"
call npm ci
if errorlevel 1 (
  set "FAILURE_MESSAGE=Backend dependency installation failed."
  goto :fail
)

echo Installing frontend dependencies from package-lock.json...
cd /d "%PROJECT_ROOT%frontend"
call npm ci
if errorlevel 1 (
  set "FAILURE_MESSAGE=Frontend dependency installation failed."
  goto :fail
)

echo Building the production frontend...
call npm run build
if errorlevel 1 (
  set "FAILURE_MESSAGE=Frontend production build failed."
  goto :fail
)

if not exist "%PROJECT_ROOT%frontend\dist\index.html" (
  set "FAILURE_MESSAGE=The build did not produce frontend\dist\index.html."
  goto :fail
)

echo.
echo Production dependencies and frontend build are ready.
>> "%BUILD_LOG%" echo [%date% %time%] Production build completed successfully.
call :pause_if_manual
exit /b 0

:fail
echo.
echo ERROR: %FAILURE_MESSAGE%
echo Review the messages above and %BUILD_LOG%.
echo.
>> "%BUILD_LOG%" echo [%date% %time%] ERROR: %FAILURE_MESSAGE%
call :pause_if_manual
exit /b 1

:pause_if_manual
if "%NO_PAUSE%"=="0" (
  echo Press any key to close this window...
  pause >nul
)
exit /b 0
