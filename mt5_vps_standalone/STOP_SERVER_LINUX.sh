#!/bin/bash
# Stop MT5 Standalone Bridge Server (Linux)
echo "Menghentikan service MT5 Bridge Server..."

# Kill process running on port 5050 or wine python api_server
pkill -f "api_server.py" 2>/dev/null || true
fuser -k 5050/tcp 2>/dev/null || true

echo "✅ MT5 Bridge Server berhasil dihentikan."
