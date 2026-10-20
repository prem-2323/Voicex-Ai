@echo off
title Stop VoiceX AI Services
cd /d "%~dp0"

echo ====================================================================
echo                 STOPPING VOICEX AI SERVICES                        
echo ====================================================================
echo.

echo [1/3] Stopping Backend on port 8001...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill.exe /F /T /PID $_ 2>$null }"
echo       Backend stopped.

echo [2/3] Stopping Frontend on port 3000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill.exe /F /T /PID $_ 2>$null }"
echo       Frontend stopped.

echo [3/3] Closing VoiceX terminal windows...
powershell -NoProfile -Command "Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*VoiceX*' } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"
taskkill /F /FI "WINDOWTITLE eq VoiceX*" >nul 2>&1

echo.
echo ====================================================================
echo VoiceX AI services have been stopped successfully!
echo ====================================================================
echo.
pause
