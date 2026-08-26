@echo off
setlocal EnableExtensions

REM Deterministic production install and frontend build. Run while the scheduled
REM application task is stopped so users never receive a half-written dist folder.
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available on PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or is not available on PATH.
  exit /b 1
)

node -e "const [major,minor]=process.versions.node.split('.').map(Number); if(!((major===20&&minor>=19)||(major===22&&minor>=12)||major>22)){console.error('ERROR: Node.js 20.19+ or 22.12+ is required. Current: '+process.version);process.exit(1)}"
if errorlevel 1 exit /b 1

if not exist "backend\.env" (
  echo ERROR: backend\.env is missing.
  echo Copy backend\.env.example to backend\.env and configure production values first.
  exit /b 1
)

echo Installing backend dependencies from package-lock.json...
cd /d "%PROJECT_ROOT%backend"
call npm ci
if errorlevel 1 exit /b 1

echo Installing frontend dependencies from package-lock.json...
cd /d "%PROJECT_ROOT%frontend"
call npm ci
if errorlevel 1 exit /b 1

echo Building the production frontend...
call npm run build
if errorlevel 1 exit /b 1

if not exist "%PROJECT_ROOT%frontend\dist\index.html" (
  echo ERROR: Frontend build completed without producing dist\index.html.
  exit /b 1
)

echo Production dependencies and frontend build are ready.
exit /b 0
