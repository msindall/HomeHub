@echo off
REM ============================================================
REM  Home Hub - one-command native deploy
REM  Run from Windows only (double-click or: deploy.bat)
REM  Does: clear stale git lock -> build+validate -> stage -> push
REM ============================================================
cd /d "%~dp0"

echo.
echo [1/4] Clearing any stale git lock...
if exist ".git\index.lock" del /f ".git\index.lock"

echo [2/4] Building (validates + prunes old builds)...
python build.py
if errorlevel 1 (
  echo.
  echo BUILD FAILED - nothing was committed or pushed.
  exit /b 1
)

echo [3/4] Staging source changes...
git add -A

echo [4/4] Writing redirect, committing, pushing...
python deploy_github.py --push

echo.
echo Done.
