@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title TradeRoom MT5 Standalone VPS Bridge Server

echo ==========================================================
echo   TradeRoom MT5 Standalone VPS Bridge Server (Windows)
echo ==========================================================
echo.

rem 1. Check if MT5 terminal64.exe exists, if not and mt5setup.exe exists, run silent auto-install
if exist "%ProgramFiles%\MetaTrader 5\terminal64.exe" goto :MT5_FOUND
if exist "%LOCALAPPDATA%\Programs\MetaTrader 5\terminal64.exe" goto :MT5_FOUND

if exist "..\mt5setup.exe" (
    echo [INFO] MT5 belum terpasang. Menjalankan silent auto-install MT5...
    start /wait "" "..\mt5setup.exe" /auto
    echo [OK] Instalasi MT5 selesai!
    goto :MT5_FOUND
)
if exist "mt5setup.exe" (
    echo [INFO] MT5 belum terpasang. Menjalankan silent auto-install MT5...
    start /wait "" "mt5setup.exe" /auto
    echo [OK] Instalasi MT5 selesai!
    goto :MT5_FOUND
)

:MT5_FOUND

rem 2. Check Python MetaTrader5 package
py -c "import MetaTrader5" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Memasang package MetaTrader5...
    py -m pip install -r requirements.txt
)

echo [STARTING] Menjalankan MT5 VPS Bridge Server...
py api_server.py
if errorlevel 1 (
    echo.
    echo [ERROR] Server berhenti dengan error.
)
pause
