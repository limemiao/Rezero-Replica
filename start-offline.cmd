@echo off
setlocal
cd /d "%~dp0"

if not exist "site\index.html" (
    echo Offline mirror not found. Run: npm run sync
    pause
    exit /b 1
)

powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:4173'"
node server.js

endlocal
