# pyright: reportMissingImports=false
# type: ignore
"""
Standalone MT5 Master Gateway & 10-Slot Dynamic Dispatcher
Features:
1. Dynamic 10-Slot Pool: Supervises 10 isolated MT5 micro-workers.
2. Auto-Shift Dispatcher: If Slot 1 is busy (< 10s active), automatically shifts to Slot 2, Slot 3, etc.
3. Persistent Credentials Cache: Stores account ID and Password in backend cache + disk until user explicit logout.
4. Auto-Reconnection: Transparently reconnects disconnected/idle sessions on demand using cached credentials.
5. Unified Port 5050: Frontend only connects to 1 endpoint.
"""
from __future__ import annotations
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

HOST = os.getenv('BRIDGE_HOST', '0.0.0.0')
PORT = int(os.getenv('BRIDGE_PORT', '5050'))
TOTAL_SLOTS = int(os.getenv('MT5_TOTAL_SLOTS', '10'))
BUSY_THRESHOLD_SECONDS = float(os.getenv('MT5_BUSY_THRESHOLD', '10.0'))  # Auto-shift threshold

# Path to persistent credentials storage file
CACHE_FILE = os.path.join(CURRENT_DIR, "credentials_vault.json")
if not os.path.exists(CURRENT_DIR):
    CACHE_FILE = "/root/.wine/drive_c/MT5_Terminals/credentials_vault.json"

# Credentials Cache: key -> { 'login': int, 'password': str, 'server': str, 'last_touch': float }
CREDENTIALS_CACHE: dict[str, dict] = {}
CACHE_LOCK = threading.RLock()


def load_cache_from_disk():
    """Load cached credentials from persistent disk storage on startup."""
    global CREDENTIALS_CACHE
    with CACHE_LOCK:
        try:
            if os.path.isfile(CACHE_FILE):
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        CREDENTIALS_CACHE = data
                        print(f"📦 [VAULT] Loaded {len(CREDENTIALS_CACHE)} account(s) credentials from disk cache.")
        except Exception as e:
            print(f"⚠️ [VAULT] Failed to load credentials from disk: {e}")


def save_cache_to_disk():
    """Save credentials to disk file so they persist even across container restarts."""
    with CACHE_LOCK:
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(CREDENTIALS_CACHE, f, indent=2)
        except Exception as e:
            print(f"⚠️ [VAULT] Failed to save credentials to disk: {e}")


# Slots Map: slot_id (1..10) -> { 'slot': int, 'port': int, 'terminal': str, 'account_key': str|None, 'last_touch': float, 'process': subprocess.Popen|None }
SLOTS: list[dict] = []
DISPATCH_LOCK = threading.RLock()


def find_terminal_paths(count: int = 10) -> list[str]:
    """Discover or generate 10 isolated terminal directories."""
    paths = []
    # Check Wine standard folder
    wine_base = "/root/.wine/drive_c/MT5_Terminals"
    if os.path.isdir(wine_base):
        for i in range(1, count + 1):
            p = f"{wine_base}/term_{i}/terminal64.exe"
            if os.path.isfile(p):
                paths.append(p)

    # Windows standard paths
    if len(paths) < count:
        win_candidates = [
            f"C:\\MT5_Terminals\\term_{i}\\terminal64.exe" for i in range(1, count + 1)
        ] + [
            f"C:\\Program Files\\MetaTrader 5\\terminal64.exe"
        ]
        for p in win_candidates:
            if os.path.isfile(p) and p not in paths:
                paths.append(p)

    # Fallback padding to default terminal64.exe path
    default_p = paths[0] if paths else "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
    while len(paths) < count:
        paths.append(default_p)

    return paths[:count]


def init_slots():
    """Initialize slot structures."""
    global SLOTS
    term_paths = find_terminal_paths(TOTAL_SLOTS)
    SLOTS = []
    for i in range(1, TOTAL_SLOTS + 1):
        SLOTS.append({
            'slot': i,
            'port': 5100 + i,
            'terminal': term_paths[i - 1] if (i - 1) < len(term_paths) else term_paths[0],
            'account_key': None,
            'last_touch': 0.0,
            'process': None
        })


def spawn_worker(slot_data: dict):
    """Start or restart a single worker subprocess."""
    script_path = os.path.join(CURRENT_DIR, "worker_instance.py")
    slot_id = slot_data['slot']
    port = slot_data['port']
    term = slot_data['terminal']

    # Detect if we should use wine or native python
    is_wine = (sys.platform != 'win32') and os.path.exists('/usr/bin/wine')
    if is_wine:
        cmd = ["wine", "python", script_path, f"--slot={slot_id}", f"--port={port}", f"--terminal={term}"]
    else:
        cmd = [sys.executable, script_path, f"--slot={slot_id}", f"--port={port}", f"--terminal={term}"]

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        slot_data['process'] = proc
        print(f"🚀 [SUPERVISOR] Spawned Worker Slot #{slot_id} on 127.0.0.1:{port} (PID: {proc.pid})")
    except Exception as e:
        print(f"❌ [SUPERVISOR] Failed to spawn Worker Slot #{slot_id}: {e}")


def supervisor_loop():
    """Monitor and auto-restart any crashed worker subprocesses."""
    while True:
        time.sleep(5)
        for s in SLOTS:
            proc = s.get('process')
            if proc is None or proc.poll() is not None:
                print(f"⚠️ [SUPERVISOR] Worker Slot #{s['slot']} died or not running. Restarting...")
                spawn_worker(s)


def query_worker_http(port: int, method: str, path: str, data: dict = None, timeout: int = 15) -> dict:
    """Send HTTP request to an internal micro-worker."""
    url = f"http://127.0.0.1:{port}{path}"
    headers = {'Content-Type': 'application/json'}
    body_bytes = json.dumps(data).encode('utf-8') if data else None

    req = Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urlopen(req, timeout=timeout) as res:
            res_body = res.read().decode('utf-8')
            return json.loads(res_body)
    except Exception as exc:
        if hasattr(exc, 'read'):
            try:
                err_json = json.loads(exc.read().decode('utf-8'))
                return err_json
            except Exception:
                pass
        raise RuntimeError(f"Internal Worker HTTP {port} Error: {exc}")


def account_key_of(login: Any, server: str = '') -> str:
    """Compute unique account key."""
    log_str = str(login).strip()
    srv_str = str(server).strip()
    return f"{log_str}@{srv_str}" if srv_str else log_str


def find_or_bind_slot(acc_key: str) -> dict:
    """
    10-Slot Dynamic Dispatcher Logic:
    1. If account is ALREADY connected on Slot X, return Slot X.
    2. If NOT connected:
       - Loop Slot 1 to 10.
       - A slot is eligible if it has no account OR its last_touch >= BUSY_THRESHOLD_SECONDS (e.g. 10s idle).
       - Select the first eligible slot (Slot 1, then Slot 2, then Slot 3...).
       - Log into this slot using credentials from CREDENTIALS_CACHE.
    """
    now = time.time()
    with DISPATCH_LOCK:
        # 1. Check if already active in one of the slots
        for s in SLOTS:
            if s['account_key'] == acc_key:
                s['last_touch'] = now
                return s

        # 2. Check if credentials exist in Cache
        with CACHE_LOCK:
            creds = CREDENTIALS_CACHE.get(acc_key)
            if not creds:
                # Try finding by login only if key was just login
                for k, v in CREDENTIALS_CACHE.items():
                    if str(v.get('login')) == acc_key or k.startswith(f"{acc_key}@"):
                        creds = v
                        acc_key = k
                        break

        if not creds:
            raise ValueError(f"Account '{acc_key}' is not logged in. Please call /api/mt5/login first.")

        # 3. Find candidate slot (checking Slot 1 .. 10)
        chosen_slot = None
        for s in SLOTS:
            # Empty slot or idle for >= BUSY_THRESHOLD_SECONDS (10s)
            if s['account_key'] is None:
                chosen_slot = s
                break
            idle_time = now - s['last_touch']
            if idle_time >= BUSY_THRESHOLD_SECONDS:
                chosen_slot = s
                break

        # Fallback: if all 10 are somehow busy in < 10s, pick the oldest least-recently-used slot
        if chosen_slot is None:
            chosen_slot = min(SLOTS, key=lambda x: x['last_touch'])

        # 4. Connect chosen slot with cached credentials
        print(f"🔀 [DISPATCHER] Assigning account {acc_key} to Slot #{chosen_slot['slot']} (Auto-Shift)...")
        login_res = query_worker_http(
            port=chosen_slot['port'],
            method='POST',
            path='/login',
            data={
                'login': creds['login'],
                'password': creds['password'],
                'server': creds['server']
            }
        )

        if login_res.get('status') != 'CONNECTED':
            err_msg = login_res.get('error', 'Login to MT5 terminal failed')
            raise RuntimeError(f"Slot #{chosen_slot['slot']} connection error: {err_msg}")

        chosen_slot['account_key'] = acc_key
        chosen_slot['last_touch'] = time.time()
        return chosen_slot


class MasterGatewayHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-MT5-Account')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-MT5-Account')
        self.end_headers()

    def _resolve_account_param(self, query: dict) -> str:
        """Resolve account key from query param, headers, or default single cached account."""
        acc_param = query.get('account', [None])[0] or query.get('login', [None])[0]
        if not acc_param:
            acc_param = self.headers.get('X-MT5-Account')

        if acc_param:
            return str(acc_param).strip()

        with CACHE_LOCK:
            if len(CREDENTIALS_CACHE) == 1:
                return list(CREDENTIALS_CACHE.keys())[0]
            elif len(CREDENTIALS_CACHE) > 1:
                # Return most recently used account
                sorted_accs = sorted(CREDENTIALS_CACHE.items(), key=lambda x: x[1].get('last_touch', 0), reverse=True)
                return sorted_accs[0][0]

        return ''

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path in ('/', '/health', '/api/health'):
            now = time.time()
            slots_summary = []
            for s in SLOTS:
                slots_summary.append({
                    'slot': s['slot'],
                    'port': s['port'],
                    'assignedAccount': s['account_key'],
                    'idleSeconds': round(now - s['last_touch'], 1) if s['last_touch'] > 0 else None,
                    'isBusy': (now - s['last_touch']) < BUSY_THRESHOLD_SECONDS if s['last_touch'] > 0 else False
                })

            with CACHE_LOCK:
                cached_accounts = [
                    {'accountKey': k, 'login': v['login'], 'server': v['server']}
                    for k, v in CREDENTIALS_CACHE.items()
                ]

            self._send_json(200, {
                'status': 'ONLINE',
                'service': 'TradeRoom MT5 10-Slot Dynamic Gateway',
                'busyThresholdSeconds': BUSY_THRESHOLD_SECONDS,
                'totalSlots': TOTAL_SLOTS,
                'cachedAccountsCount': len(cached_accounts),
                'cachedAccounts': cached_accounts,
                'slots': slots_summary,
                'serverTimeUtc': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            })
            return

        if path == '/api/mt5/accounts':
            with CACHE_LOCK:
                acc_list = [
                    {'accountKey': k, 'login': v['login'], 'server': v['server'], 'lastTouch': v.get('last_touch', 0)}
                    for k, v in CREDENTIALS_CACHE.items()
                ]
            self._send_json(200, {'status': 'SUCCESS', 'accounts': acc_list})
            return

        if path == '/api/mt5/snapshot':
            acc_key = self._resolve_account_param(query)
            if not acc_key:
                self._send_json(400, {'error': 'No active account. Please login first or specify ?account=<login>'})
                return

            try:
                slot = find_or_bind_slot(acc_key)
                res = query_worker_http(port=slot['port'], method='GET', path='/snapshot')
                self._send_json(200, res)
            except Exception as e:
                self._send_json(500, {'error': str(e)})
            return

        if path == '/api/mt5/history':
            acc_key = self._resolve_account_param(query)
            if not acc_key:
                self._send_json(400, {'error': 'No active account. Please login first or specify ?account=<login>'})
                return

            days = query.get('days', ['60'])[0]
            try:
                slot = find_or_bind_slot(acc_key)
                res = query_worker_http(port=slot['port'], method='GET', path=f"/history?days={days}")
                self._send_json(200, res)
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

            if not login or not password or not server:
                self._send_json(400, {'error': 'Fields login, password, and server are required.'})
                return

            acc_key = account_key_of(login, server)

            # Store credentials in backend memory cache + persist to disk
            with CACHE_LOCK:
                CREDENTIALS_CACHE[acc_key] = {
                    'login': int(login),
                    'password': str(password),
                    'server': str(server),
                    'last_touch': time.time()
                }
                save_cache_to_disk()

            try:
                # Bind / Auto-Shift to available slot (1..10)
                slot = find_or_bind_slot(acc_key)
                # Query account status
                status_res = query_worker_http(port=slot['port'], method='GET', path='/status')
                acc_data = status_res.get('currentAccount')

                self._send_json(200, {
                    'status': 'CONNECTED',
                    'slot': slot['slot'],
                    'account': acc_data,
                    'accountKey': acc_key,
                    'cached': True
                })
            except Exception as e:
                # Remove on failure
                with CACHE_LOCK:
                    CREDENTIALS_CACHE.pop(acc_key, None)
                    save_cache_to_disk()
                self._send_json(401, {'error': str(e)})
            return

        if path in ('/api/mt5/disconnect', '/api/mt5/logout'):
            login = body.get('login')
            server = body.get('server', '')
            acc_param = account_key_of(login, server) if login else self._resolve_account_param({})

            # Remove from credentials cache & disk vault
            with CACHE_LOCK:
                CREDENTIALS_CACHE.pop(acc_param, None)
                save_cache_to_disk()

            # Disconnect slot if currently bound
            with DISPATCH_LOCK:
                for s in SLOTS:
                    if s['account_key'] == acc_param or (acc_param and s['account_key'] and s['account_key'].startswith(f"{acc_param}@")):
                        s['account_key'] = None
                        s['last_touch'] = 0.0
                        try:
                            query_worker_http(port=s['port'], method='POST', path='/disconnect')
                        except Exception:
                            pass

            print(f"🛑 [LOGOUT] Account {acc_param} logged out and removed from credentials cache.")
            self._send_json(200, {
                'status': 'DISCONNECTED',
                'account': acc_param,
                'cacheCleared': True
            })
            return

        self._send_json(404, {'error': f'Endpoint not found: {path}'})


def start_master_gateway():
    print("=" * 65)
    print(f"🌟 TradeRoom MT5 10-Slot Dynamic Master Gateway Starting...")
    print(f"   - Listening on          : http://{HOST}:{PORT}")
    print(f"   - Total Isolated Slots  : {TOTAL_SLOTS}")
    print(f"   - Auto-Shift Idle Rule  : {BUSY_THRESHOLD_SECONDS}s threshold")
    print(f"   - Backend Creds Vault   : PERSISTENT (Saved until explicit logout)")
    print("=" * 65)

    load_cache_from_disk()
    init_slots()

    # Spawn all 10 worker subprocesses
    for s in SLOTS:
        spawn_worker(s)

    # Start supervisor thread
    sup_thread = threading.Thread(target=supervisor_loop, daemon=True)
    sup_thread.start()

    server = ThreadingHTTPServer((HOST, PORT), MasterGatewayHandler)
    print(f"✅ [MASTER GATEWAY] Ready on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Master Gateway and Workers...")
        for s in SLOTS:
            proc = s.get('process')
            if proc:
                proc.terminate()
        server.server_close()


if __name__ == '__main__':
    start_master_gateway()
