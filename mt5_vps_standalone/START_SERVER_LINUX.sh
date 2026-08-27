#!/bin/bash
# TradeRoom MT5 Standalone VPS Bridge Server (Linux Auto-Setup Edition)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "  TradeRoom MT5 Standalone VPS Bridge Server (Linux/Wine) "
echo "=========================================================="

# 1. Check if Wine is installed, if not, offer/auto-run mt5ubuntu script
if ! command -v wine &> /dev/null; then
    echo "[INFO] Wine belum terpasang. Menjalankan auto-installer Wine & MT5 resmi..."
    wget -q https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5ubuntu.sh
    chmod +x mt5ubuntu.sh
    ./mt5ubuntu.sh
fi

# 2. Check if Python in Wine is installed
if ! wine python --version &> /dev/null; then
    echo "[INFO] Memasang Python Windows di Wine secara otomatis..."
    if [ ! -f "python-3.11.9-amd64.exe" ]; then
        wget -q https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
    fi
    wine python-3.11.9-amd64.exe /quiet InstallAllUsers=1 PrependPath=1
    wine python -m pip install --upgrade pip
    wine python -m pip install -r requirements.txt
fi

echo "[STARTING] Menjalankan MT5 API Bridge Server via Wine..."
wine python api_server.py
