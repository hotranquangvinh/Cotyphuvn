@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js. Hay cai Node.js truoc khi chay game.
  pause
  exit /b 1
)

echo Dang mo server game o http://localhost:3000 ...
start "Co Ty Phu Server" cmd /k "cd /d ""%~dp0"" && node server.js"

pause
