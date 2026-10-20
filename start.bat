@echo off
setlocal
title VoiceX AI Launcher

cd /d "%~dp0"

echo ====================================================================
echo                 VOICEX AI - REAL-TIME VOICE ASSISTANT              
echo ====================================================================
echo.

:: 1. Backend Dependencies Check & Auto-Install
echo [1/4] Checking Python Backend dependencies...
if not exist "%~dp0Backend\.venv\Scripts\python.exe" (
    echo       Creating Python virtual environment...
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python not found in PATH! Please install Python 3.10 or 3.11.
        pause
        exit /b 1
    )
    python -m venv "%~dp0Backend\.venv"
    echo       Installing Backend requirements...
    "%~dp0Backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
    "%~dp0Backend\.venv\Scripts\python.exe" -m pip install -r "%~dp0Backend\requirements.txt"
) else (
    "%~dp0Backend\.venv\Scripts\python.exe" -c "import fastapi, uvicorn, faster_whisper, edge_tts" >nul 2>&1
    if errorlevel 1 (
        echo       Installing missing Backend packages...
        "%~dp0Backend\.venv\Scripts\python.exe" -m pip install -r "%~dp0Backend\requirements.txt"
    ) else (
        echo       Backend packages are ready.
    )
)

:: Piper voice models check
if not exist "%~dp0Backend\models\piper\en_US-lessac-medium.onnx" (
    echo       Downloading Piper TTS voice models...
    "%~dp0Backend\.venv\Scripts\python.exe" "%~dp0Backend\scripts\download_piper_models.py"
)
echo.

:: 2. Frontend Dependencies Check & Auto-Install
echo [2/4] Checking Frontend Node packages...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm not found in PATH!
    pause
    exit /b 1
)

if not exist "%~dp0Frontend\node_modules" (
    echo       Installing Frontend packages via npm...
    cd /d "%~dp0Frontend"
    call npm install
    cd /d "%~dp0"
    echo       Frontend packages installed.
) else (
    echo       Frontend packages are ready.
)
echo.

:: 3. Ollama Server Check & Launch
echo [3/4] Checking Ollama Service...
netstat -ano | findstr ":11434" >nul 2>&1
if errorlevel 1 (
    where ollama >nul 2>&1
    if not errorlevel 1 (
        echo       Starting Ollama server...
        start "VoiceX - Ollama Server" cmd /k "ollama serve"
        ping 127.0.0.1 -n 4 >nul
        echo       Ollama server started.
    ) else (
        if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
            echo       Starting Ollama server...
            start "VoiceX - Ollama Server" cmd /k ""%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve"
            ping 127.0.0.1 -n 4 >nul
            echo       Ollama server started.
        ) else (
            echo [WARNING] Ollama not found. Ensure Ollama is installed from https://ollama.com
        )
    )
) else (
    echo       Ollama is already running on port 11434.
)
echo.

:: 4. Launch Backend & Frontend in separate titled windows
echo [4/4] Starting VoiceX AI Servers...

echo       Starting FastAPI Backend on http://127.0.0.1:8001 ...
start "VoiceX - FastAPI Backend" /D "%~dp0Backend" cmd /k "call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"
ping 127.0.0.1 -n 3 >nul

echo       Starting React Frontend on http://localhost:3000 ...
start "VoiceX - React Frontend" /D "%~dp0Frontend" cmd /k "npm run dev"
ping 127.0.0.1 -n 4 >nul

echo       Opening Web UI in your default browser...
start http://localhost:3000
echo.

echo ====================================================================
echo                 ALL VOICEX AI SERVICES ARE RUNNING!                 
echo ====================================================================
echo.
echo   * Frontend Web UI    : http://localhost:3000
echo   * Backend API Server : http://127.0.0.1:8001
echo   * Interactive Docs   : http://127.0.0.1:8001/docs
echo   * Ollama Service     : http://127.0.0.1:11434
echo.
echo   To shut down all services at once, run: stop.bat
echo.

:MENU
echo --------------------------------------------------------------------
echo Options:
echo   [B] Re-open Web UI in browser
echo   [S] Stop all VoiceX services and exit
echo   [Q] Close this launcher window only
echo --------------------------------------------------------------------
set "choice="
set /p choice="Enter B, S, or Q: "

if /i "%choice%"=="B" (
    start http://localhost:3000
    goto MENU
)
if /i "%choice%"=="S" (
    call "%~dp0stop.bat"
    exit /b 0
)
if /i "%choice%"=="Q" (
    exit /b 0
)
goto MENU
