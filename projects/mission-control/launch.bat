@echo off
cd /d "%~dp0app\server"
start "" /min cmd /c "npm run dev > ..\server.log 2>&1"
timeout /t 3 /nobreak > nul
cd /d "%~dp0app\client"
start "" /min cmd /c "npm run dev > ..\client.log 2>&1"
timeout /t 4 /nobreak > nul
start "" "http://localhost:5173"
