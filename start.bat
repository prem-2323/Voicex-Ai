@echo off
setlocal EnableExtensions
title VoiceX AI Launcher

set "ROOT=%~dp0"
set "BACKEND=%ROOT%Backend"
set "FRONTEND=%ROOT%Frontend"
set "VENV_PYTHON=%BACKEND%\.venv\Scripts\python.exe"
set "OLLAMA_MODEL=qwen2.5:3b"

cd /d "%ROOT%"
echo ================================================================
echo                 VOICEX AI - PROJECT LAUNCHER
echo ================================================================
echo.

echo [1/6] Checking required tools...
where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is required. Install Node.js 20.19+ or 22.12+.
    goto :FAIL
)
where npm.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js and npm are required. Install Node.js 20.19+ or 22.12+.
    goto :FAIL
)
node.exe -e "const [major,minor]=process.versions.node.split('.').map(Number); if (!((major===20&&minor>=19)||(major>=22&&(major>22||minor>=12)))) process.exit(1)"
if errorlevel 1 (
    echo [ERROR] Unsupported Node.js version. Install Node.js 20.19+ or 22.12+.
    goto :FAIL
)

set "PYTHON_CMD="
where py.exe >nul 2>&1
if not errorlevel 1 (
    py -3.11 --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py -3.11"
    if not defined PYTHON_CMD (
        py -3.10 --version >nul 2>&1
        if not errorlevel 1 set "PYTHON_CMD=py -3.10"
    )
)
if not defined PYTHON_CMD (
    where python.exe >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
    echo [ERROR] Python was not found. Install Python 3.10 or 3.11 and try again.
    goto :FAIL
)

if not exist "%BACKEND%\.venv\Scripts\python.exe" (
    echo       Creating backend virtual environment...
    %PYTHON_CMD% -m venv "%BACKEND%\.venv"
    if errorlevel 1 (
        echo [ERROR] Could not create the Python virtual environment.
        goto :FAIL
    )
)

echo [2/6] Checking backend packages...
"%VENV_PYTHON%" -c "import fastapi, uvicorn, faster_whisper, edge_tts, httpx" >nul 2>&1
if errorlevel 1 (
    echo       Installing backend requirements...
    "%VENV_PYTHON%" -m pip install --upgrade pip
    if errorlevel 1 (
        echo [ERROR] Could not upgrade pip.
        goto :FAIL
    )
    "%VENV_PYTHON%" -m pip install -r "%BACKEND%\requirements.txt"
    if errorlevel 1 (
        echo [ERROR] Backend requirements installation failed.
        goto :FAIL
    )
)

"%VENV_PYTHON%" -c "import piper, onnxruntime" >nul 2>&1
if errorlevel 1 (
    echo       Installing local Piper text-to-speech packages...
    "%VENV_PYTHON%" -m pip install piper-tts onnxruntime
    if errorlevel 1 (
        echo [ERROR] Piper installation failed.
        goto :FAIL
    )
)

if not exist "%BACKEND%\.env" (
    if exist "%BACKEND%\.env.example" (
        copy /Y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
        if errorlevel 1 (
            echo [ERROR] Could not create Backend\.env from Backend\.env.example.
            goto :FAIL
        )
    )
)

if not exist "%BACKEND%\models\piper\en_US-lessac-medium.onnx" goto :DOWNLOAD_VOICES
if not exist "%BACKEND%\models\piper\en_US-lessac-medium.onnx.json" goto :DOWNLOAD_VOICES
if not exist "%BACKEND%\models\piper\hi_IN-pratham-medium.onnx" goto :DOWNLOAD_VOICES
if not exist "%BACKEND%\models\piper\hi_IN-pratham-medium.onnx.json" goto :DOWNLOAD_VOICES
goto :VOICES_READY

:DOWNLOAD_VOICES
echo       Downloading required English and Hindi Piper voices...
"%VENV_PYTHON%" "%BACKEND%\scripts\download_piper_models.py"
if errorlevel 1 (
    echo [ERROR] Piper voice download failed. Check your internet connection and retry.
    goto :FAIL
)

:VOICES_READY
echo [3/6] Checking frontend packages...
if not exist "%FRONTEND%\node_modules\.bin\vite.cmd" (
    echo       Installing frontend packages...
    pushd "%FRONTEND%"
    if exist package-lock.json (
        call npm ci
    ) else (
        call npm install
    )
    set "NPM_RESULT=%ERRORLEVEL%"
    popd
    if not "%NPM_RESULT%"=="0" (
        echo [ERROR] Frontend package installation failed.
        goto :FAIL
    )
)

echo [4/6] Checking Ollama...
where ollama.exe >nul 2>&1
if not errorlevel 1 (
    set "OLLAMA_EXE=ollama.exe"
) else (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    ) else (
        echo [ERROR] Ollama was not found. Install it from https://ollama.com and retry.
        goto :FAIL
    )
)

call :CHECK_OLLAMA
if errorlevel 1 (
    echo       Starting Ollama...
    if /I "%OLLAMA_EXE%"=="ollama.exe" (
        start "VoiceX - Ollama" /min ollama.exe serve
    ) else (
        start "VoiceX - Ollama" /min "%OLLAMA_EXE%" serve
    )
    call :WAIT_OLLAMA
    if errorlevel 1 (
        echo [ERROR] Ollama did not become ready at http://127.0.0.1:11434.
        goto :FAIL
    )
)

"%OLLAMA_EXE%" list 2>nul | findstr /I /C:"%OLLAMA_MODEL%" >nul
if errorlevel 1 (
    echo       Downloading Ollama model %OLLAMA_MODEL% (this may take a while)...
    "%OLLAMA_EXE%" pull %OLLAMA_MODEL%
    if errorlevel 1 (
        echo [ERROR] Could not download %OLLAMA_MODEL%. Check Ollama and your internet connection.
        goto :FAIL
    )
)

echo [5/6] Starting backend...
call :CHECK_BACKEND
if errorlevel 1 (
    start "VoiceX - FastAPI Backend" /D "%BACKEND%" cmd /k ""%VENV_PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"
    call :WAIT_BACKEND
    if errorlevel 1 (
        echo [ERROR] Backend did not become ready at http://127.0.0.1:8001.
        echo        Check the "VoiceX - FastAPI Backend" window for details.
        goto :FAIL
    )
) else (
    echo       Backend is already responding on port 8001.
)

echo [6/6] Starting frontend...
call :CHECK_FRONTEND
if errorlevel 1 (
    start "VoiceX - Frontend" /D "%FRONTEND%" cmd /k "npm run dev"
    call :WAIT_FRONTEND
    if errorlevel 1 (
        echo [ERROR] Frontend did not become ready at http://localhost:3000.
        echo        Check the "VoiceX - Frontend" window for details.
        goto :FAIL
    )
) else (
    echo       Frontend is already responding on port 3000.
)

echo.
echo ================================================================
echo                 VOICEX AI IS READY
echo ================================================================
echo   Web app:       http://localhost:3000
echo   Backend API:   http://127.0.0.1:8001
echo   API docs:      http://127.0.0.1:8001/docs
echo   Ollama:        http://127.0.0.1:11434
echo.
echo Allow microphone access when your browser asks.
echo Run stop.bat to stop the VoiceX backend and frontend.
echo ================================================================
start "" http://localhost:3000
exit /b 0

:CHECK_OLLAMA
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:WAIT_OLLAMA
set /a ATTEMPTS=0
:WAIT_OLLAMA_LOOP
call :CHECK_OLLAMA
if not errorlevel 1 exit /b 0
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 45 exit /b 1
timeout /t 1 /nobreak >nul
goto :WAIT_OLLAMA_LOOP

:CHECK_BACKEND
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:8001/api/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:WAIT_BACKEND
set /a ATTEMPTS=0
:WAIT_BACKEND_LOOP
call :CHECK_BACKEND
if not errorlevel 1 exit /b 0
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 60 exit /b 1
timeout /t 1 /nobreak >nul
goto :WAIT_BACKEND_LOOP

:CHECK_FRONTEND
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:WAIT_FRONTEND
set /a ATTEMPTS=0
:WAIT_FRONTEND_LOOP
call :CHECK_FRONTEND
if not errorlevel 1 exit /b 0
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 45 exit /b 1
timeout /t 1 /nobreak >nul
goto :WAIT_FRONTEND_LOOP

:FAIL
echo.
echo VoiceX AI could not be started. Resolve the error above and run start.bat again.
pause
exit /b 1
