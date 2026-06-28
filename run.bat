@echo off
setlocal enabledelayedexpansion
title Vermicast Prototype Starter

echo ============================================================
echo  Vermicast Forecasting and Inventory  Prototype
echo  Capstone Project  -  EcoAgri
echo ============================================================
echo.

REM ---------- 1. Python check ----------
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.x from https://www.python.org/downloads/
    echo and make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python !PY_VER! found.
echo.

REM ---------- 2. Per-package dependency check ----------
echo Checking required Python packages...

set MISSING=
set PKGS=flask flask_cors numpy pandas statsmodels

for %%p in (!PKGS!) do (
    python -c "import %%p" >nul 2>nul
    if errorlevel 1 (
        echo   [MISSING] %%p
        set MISSING=!MISSING! %%p
    ) else (
        echo   [OK] %%p
    )
)
echo.

REM ---------- 3. Auto-install missing packages ----------
if not "!MISSING!"=="" (
    echo The following packages are missing:!MISSING!
    echo Installing them now from requirements.txt ...
    echo.
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [ERROR] pip install failed. Please run "pip install -r requirements.txt" manually.
        pause
        exit /b 1
    )
    echo.
    echo [OK] All dependencies installed.
) else (
    echo [OK] All dependencies already installed.
)
echo.

REM ---------- 4. Start services ----------
echo Starting Vermicast Forecasting Backend (Port 5001)...
start /b python app.py
echo.
echo Starting Web Server for Frontend (Port 8000)...
echo This avoids "file://" security restrictions.
start /b python -m http.server 8000
echo.
echo Waiting for services to initialize...
timeout /t 3 /nobreak > nul
echo.
echo Opening Application...
start http://localhost:8000/index.html
echo.
echo ============================================================
echo  System is running!
echo  Keep this window open while using the application.
echo  Frontend:  http://localhost:8000
echo  Backend:   http://localhost:5001
echo ============================================================
echo.
echo To stop the system, close this window and use Ctrl+C in the Python windows.
pause
endlocal
