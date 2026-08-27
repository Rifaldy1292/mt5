# pyright: reportMissingImports=false
# type: ignore
"""
Standalone MT5 API Bridge Server
Provides REST endpoints to connect MT5, stream live snapshots, and fetch parsed trading journal history.
Runs on http://127.0.0.1:5050 by default.
"""
from __future__ import annotations
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Ensure current script folder is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

try:
    from mt5_client import MT5Session, is_mt5_available
    from history_parser import extract_trading_history
except Exception:
    from .mt5_client import MT5Session, is_mt5_available  # type: ignore
    from .history_parser import extract_trading_history  # type: ignore

HOST = os.getenv('BRIDGE_HOST', '127.0.0.1')
PORT = int(os.getenv('BRIDGE_PORT', '5050'))

SESSION = MT5Session()


class BridgeRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/health':
            self._send_json(200, {
                'status': 'ONLINE',
                'mt5Library': is_mt5_available(),
                'connected': SESSION.is_connected,
                'currentAccount': SESSION.current_account
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
                acc = SESSION.connect(login=int(login), password=str(password), server=str(server))
                self._send_json(200, {
                    'status': 'CONNECTED',
                    'account': acc
                })
            except Exception as e:
                self._send_json(401, {'error': str(e)})
            return

        if path == '/api/mt5/disconnect':
            SESSION.disconnect()
            self._send_json(200, {'status': 'DISCONNECTED'})
            return

        self._send_json(404, {'error': f'Endpoint not found: {path}'})


def run_server():
    server = ThreadingHTTPServer((HOST, PORT), BridgeRequestHandler)
    print(f"🚀 MT5 Journal Bridge API running at http://{HOST}:{PORT}")
    print(f"   - POST /api/mt5/login")
    print(f"   - GET  /api/mt5/snapshot")
    print(f"   - GET  /api/mt5/history?days=60")
    print(f"   - POST /api/mt5/disconnect")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping MT5 Bridge...")
        SESSION.disconnect()
        server.server_close()


if __name__ == '__main__':
    run_server()
