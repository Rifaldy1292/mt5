# pyright: reportMissingImports=false
# type: ignore
"""
Standalone MT5 Worker Instance (Micro-Worker)
Controls 1 isolated portable MetaTrader 5 terminal process in Wine/Windows.
Listens on localhost internal port (e.g. 127.0.0.1:5101 .. 5110).
"""
from __future__ import annotations
import argparse
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

parser = argparse.ArgumentParser(description="MT5 Worker Micro-Service")
parser.add_argument('--slot', type=int, default=1, help='Slot ID (1-10)')
parser.add_argument('--port', type=int, default=5101, help='Internal worker HTTP port')
parser.add_argument('--terminal', type=str, default='', help='Path to terminal64.exe')
args, _ = parser.parse_known_args()

SLOT_ID = args.slot
PORT = args.port
TERMINAL_PATH = args.terminal

SESSION = MT5Session(terminal_path=TERMINAL_PATH)
LAST_TOUCH = time.time()
LOCK = threading.Lock()


def touch():
    global LAST_TOUCH
    with LOCK:
        LAST_TOUCH = time.time()


class WorkerRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def do_GET(self):
        touch()
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/status':
            self._send_json(200, {
                'slot': SLOT_ID,
                'port': PORT,
                'terminalPath': TERMINAL_PATH,
                'connected': SESSION.is_connected,
                'currentAccount': SESSION.current_account,
                'lastTouch': LAST_TOUCH,
                'idleSeconds': round(time.time() - LAST_TOUCH, 1)
            })
            return

        if path == '/snapshot':
            if not SESSION.is_connected:
                self._send_json(400, {'error': f'Slot {SLOT_ID} MT5 is not connected.'})
                return
            try:
                snap = SESSION.get_snapshot()
                snap['slotId'] = SLOT_ID
                self._send_json(200, {'status': 'SUCCESS', 'data': snap})
            except Exception as e:
                self._send_json(500, {'error': str(e)})
            return

        if path == '/history':
            if not SESSION.is_connected:
                self._send_json(400, {'error': f'Slot {SLOT_ID} MT5 is not connected.'})
                return
            days = int(query.get('days', ['60'])[0])
            try:
                history = extract_trading_history(days=days, account_info=SESSION.current_account)
                history['slotId'] = SLOT_ID
                self._send_json(200, {'status': 'SUCCESS', 'data': history})
            except Exception as e:
                self._send_json(500, {'error': str(e)})
            return

        self._send_json(404, {'error': f'Worker Slot {SLOT_ID} endpoint not found: {path}'})

    def do_POST(self):
        touch()
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body_raw = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            body = json.loads(body_raw)
        except Exception:
            body = {}

        if path == '/login':
            login = body.get('login')
            password = body.get('password')
            server = body.get('server')

            if not login or not password or not server:
                self._send_json(400, {'error': 'Fields login, password, and server are required.'})
                return

            try:
                print(f"🔑 [WORKER #{SLOT_ID}] Connecting to {login}@{server} (Terminal: {TERMINAL_PATH})...")
                acc = SESSION.connect(login=int(login), password=str(password), server=str(server))
                print(f"✅ [WORKER #{SLOT_ID}] Connected: {acc.get('login')}@{acc.get('server')}")
                self._send_json(200, {
                    'status': 'CONNECTED',
                    'slot': SLOT_ID,
                    'account': acc
                })
            except Exception as e:
                print(f"❌ [WORKER #{SLOT_ID}] Connect failed: {e}")
                self._send_json(401, {'error': str(e)})
            return

        if path == '/disconnect':
            SESSION.disconnect()
            print(f"🛑 [WORKER #{SLOT_ID}] Disconnected.")
            self._send_json(200, {'status': 'DISCONNECTED', 'slot': SLOT_ID})
            return

        self._send_json(404, {'error': f'Worker Slot {SLOT_ID} endpoint not found: {path}'})


def run_worker():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), WorkerRequestHandler)
    print(f"🚀 [WORKER #{SLOT_ID}] Micro-Server online on 127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        SESSION.disconnect()
        server.server_close()


if __name__ == '__main__':
    run_worker()
