@echo off
setlocal EnableExtensions

REM Stop the Windows Task Scheduler task before running this script, then start
REM the task again after this script succeeds.
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not installed or is not available on PATH.
  exit /b 1
)

git diff --quiet
if errorlevel 1 (
  echo ERROR: Tracked local files have changes. Commit or discard them before updating production.
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
  echo ERROR: The production checkout has staged changes. Resolve them before updating.
  exit /b 1
)

echo Pulling the latest main branch without creating a merge commit...
git pull --ff-only origin main
if errorlevel 1 exit /b 1

call "%PROJECT_ROOT%build.bat" --no-pause
if errorlevel 1 exit /b 1

echo Production update completed. Start the scheduled application task now.
exit /b 0
