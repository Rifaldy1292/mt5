# pyright: reportMissingImports=false
# type: ignore
"""
Standalone MT5 API Bridge Server for VPS
Listens on 0.0.0.0:5050 (or BRIDGE_PORT) to accept remote requests from local / cloud frontend.
Features:
- Full CORS support
- Remote access from local PC / Mac Svelte frontend
- Auto-Sleep / Hibernation on idle to save VPS CPU/RAM
"""
from __future__ import annotations
import json
import os
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Ensure current script folder is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from mt5_client import MT5Session, is_mt5_available
from history_parser import extract_trading_history

HOST = os.getenv('BRIDGE_HOST', '0.0.0.0')  # Listen on all interfaces for remote access
PORT = int(os.getenv('BRIDGE_PORT', '5050'))
IDLE_TIMEOUT_SECONDS = int(os.getenv('MT5_IDLE_SECONDS', '1800'))  # 30 min auto-sleep

SESSION = MT5Session()
LAST_TOUCH = time.time()
IDLE_LOCK = threading.Lock()


def touch_session():
    """Update last activity timestamp."""
    global LAST_TOUCH
    with IDLE_LOCK:
        LAST_TOUCH = time.time()


def idle_guardian_loop():
    """Background thread that automatically hibernates MT5 if idle for IDLE_TIMEOUT_SECONDS."""
    while True:
        time.sleep(30)
        with IDLE_LOCK:
            if SESSION.is_connected:
                idle_duration = time.time() - LAST_TOUCH
                if idle_duration > IDLE_TIMEOUT_SECONDS:
                    print(f"💤 [AUTO-SLEEP] MT5 session idle for {int(idle_duration)}s. Hibernating to save VPS RAM...")
                    SESSION.disconnect()


class BridgeRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()

    def do_GET(self):
        touch_session()
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/' or path == '/health':
            self._send_json(200, {
                'status': 'ONLINE',
                'service': 'TradeRoom MT5 VPS Bridge',
                'mt5Library': is_mt5_available(),
                'connected': SESSION.is_connected,
                'currentAccount': SESSION.current_account,
                'serverTimeUtc': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            })
            return

        if path == '/api/mt5/snapshot':
            if not SESSION.is_connected:
                self._send_json(400, {'error': 'MT5 is not connected. Please login first.'})
                return
            try:
                snap = SESSION.get_snapshot()
                self._send_json(200, {'status': 'SUCCESS', 'data': snap})
            except Exception as e:
                self._send_json(500, {'error': str(e)})
            return

        if path == '/api/mt5/history':
            if not SESSION.is_connected:
                self._send_json(400, {'error': 'MT5 is not connected. Please login first.'})
                return
            days = int(query.get('days', ['60'])[0])
            try:
                history = extract_trading_history(days=days, account_info=SESSION.current_account)
                self._send_json(200, {'status': 'SUCCESS', 'data': history})
            except Exception as e:
                self._send_json(500, {'error': str(e)})
            return

        self._send_json(404, {'error': f'Endpoint not found: {path}'})

    def do_POST(self):
        touch_session()
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body_raw = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            body = json.loads(body_raw)
        except Exception:
            body = {}

        if path == '/api/mt5/login':
            login = body.get('login')
            password = body.get('password')
            server = body.get('server')
            terminal_path = body.get('terminalPath')

            if not login or not password or not server:
                self._send_json(400, {'error': 'Fields login, password, and server are required.'})
                return

            try:
                if terminal_path:
                    SESSION.terminal_path = terminal_path
                print(f"🔑 [LOGIN REQUEST] Account {login} on {server}...")
                acc = SESSION.connect(login=int(login), password=str(password), server=str(server))
                print(f"✅ [CONNECTED] Account {login} successfully logged in!")
                self._send_json(200, {
                    'status': 'CONNECTED',
                    'account': acc
                })
            except Exception as e:
                print(f"❌ [LOGIN ERROR] {e}")
                self._send_json(401, {'error': str(e)})
            return

        if path == '/api/mt5/disconnect':
            SESSION.disconnect()
            print("🛑 [DISCONNECT] MT5 session closed.")
            self._send_json(200, {'status': 'DISCONNECTED'})
            return

        self._send_json(404, {'error': f'Endpoint not found: {path}'})


def run_server():
    guardian = threading.Thread(target=idle_guardian_loop, daemon=True)
    guardian.start()

    server = ThreadingHTTPServer((HOST, PORT), BridgeRequestHandler)
    print("=" * 65)
    print(f"🚀 MT5 VPS Standalone Bridge Server Running!")
    print(f"   - Listening on : http://{HOST}:{PORT}")
    print(f"   - Auto-Sleep   : {IDLE_TIMEOUT_SECONDS}s idle timeout")
    print(f"   - Health Check : http://{HOST}:{PORT}/health")
    print("=" * 65)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping MT5 Bridge...")
        SESSION.disconnect()
        server.server_close()


if __name__ == '__main__':
    run_server()
