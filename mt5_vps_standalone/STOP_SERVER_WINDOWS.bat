@echo off
echo Menghentikan service MT5 Bridge Server...
taskkill /f /im python.exe /fi "WINDOWTITLE eq TradeRoom MT5 Standalone VPS Bridge Server" 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5050') do taskkill /f /pid %%a 2>nul
echo [OK] MT5 Bridge Server berhasil dihentikan.
pause
