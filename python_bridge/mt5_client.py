# pyright: reportMissingImports=false
# type: ignore
"""
MT5 Client & Session Manager Module
Handles MetaTrader 5 terminal initialization, credentials authentication,
real-time account metrics, active open positions, and session lifecycle.
"""
from __future__ import annotations
import math
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None


def is_mt5_available() -> bool:
    """Check if MetaTrader5 python library is installed and available."""
    return mt5 is not None


def safe_float(val: Any, default: float = 0.0) -> float:
    """Safely convert value to finite float."""
    try:
        x = float(val)
        return x if math.isfinite(x) else default
    except Exception:
        return default


def discover_terminals() -> List[str]:
    """Auto-detect candidate MetaTrader 5 terminal64.exe installations on Windows."""
    found: List[str] = []
    roots = []
    for key in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
        val = os.getenv(key, '').strip()
        if val and os.path.isdir(val):
            roots.append(Path(val))

    for root in roots:
        patterns = ['*/terminal64.exe', '*/*/terminal64.exe']
        if root.name.lower() == 'appdata':
            patterns.append('Programs/*/terminal64.exe')
        for pat in patterns:
            try:
                for fpath in root.glob(pat):
                    p_str = str(fpath.resolve())
                    if p_str.lower() not in [x.lower() for x in found]:
                        found.append(p_str)
            except Exception:
                continue
    return found


class MT5Session:
    """Manages active MetaTrader 5 connection and real-time state extraction."""

    def __init__(self, terminal_path: Optional[str] = None):
        self.terminal_path = terminal_path or os.getenv('MT5_TERMINAL_PATH', '').strip()
        self.is_connected = False
        self.current_account: Optional[Dict[str, Any]] = None
        self._lock = threading.RLock()

    def connect(self, login: int, password: str, server: str, timeout: int = 60000) -> Dict[str, Any]:
        """
        Initialize terminal and login to MT5 trading account.
        """
        if not is_mt5_available():
            raise RuntimeError("MetaTrader5 library is not installed in Python environment. Run: pip install MetaTrader5")

        with self._lock:
            # 1. Determine terminal path
            path = self.terminal_path
            if not path:
                terminals = discover_terminals()
                if terminals:
                    path = terminals[0]

            # 2. Attempt initialization
            init_success = False
            if path and os.path.isfile(path):
                init_success = bool(mt5.initialize(path=path, login=int(login), password=str(password), server=str(server), timeout=timeout))
            else:
                init_success = bool(mt5.initialize(login=int(login), password=str(password), server=str(server), timeout=timeout))

            # 3. If standard initialize with credentials failed, try manual login
            if not init_success:
                err = mt5.last_error()
                # Try initialize base first, then login
                if path and os.path.isfile(path):
                    mt5.initialize(path=path)
                else:
                    mt5.initialize()

                login_ok = mt5.login(login=int(login), password=str(password), server=str(server), timeout=timeout)
                if not login_ok:
                    last_err = mt5.last_error()
                    mt5.shutdown()
                    self.is_connected = False
                    self.current_account = None
                    raise RuntimeError(f"MT5 login failed. Code: {last_err}")

            # 4. Extract account information
            acc = mt5.account_info()
            if acc is None:
                last_err = mt5.last_error()
                mt5.shutdown()
                self.is_connected = False
                self.current_account = None
                raise RuntimeError(f"Failed to retrieve account_info: {last_err}")

            mode_val = int(getattr(acc, 'trade_mode', -1) or 0)
            trade_mode = {0: 'DEMO', 1: 'CONTEST', 2: 'LIVE'}.get(mode_val, 'UNKNOWN')

            account_data = {
                'accountKey': f"{acc.login}@{acc.server}",
                'login': str(acc.login),
                'name': str(getattr(acc, 'name', '') or ''),
                'server': str(getattr(acc, 'server', '') or ''),
                'company': str(getattr(acc, 'company', '') or ''),
                'currency': str(getattr(acc, 'currency', 'USD') or 'USD'),
                'leverage': int(getattr(acc, 'leverage', 0) or 0),
                'tradeMode': trade_mode,
                'tradeAllowed': bool(getattr(acc, 'trade_allowed', False)),
                'tradeExpert': bool(getattr(acc, 'trade_expert', False)),
                'balance': safe_float(getattr(acc, 'balance', 0)),
                'credit': safe_float(getattr(acc, 'credit', 0)),
                'profit': safe_float(getattr(acc, 'profit', 0)),
                'equity': safe_float(getattr(acc, 'equity', 0)),
                'margin': safe_float(getattr(acc, 'margin', 0)),
                'marginFree': safe_float(getattr(acc, 'margin_free', 0)),
                'marginLevel': safe_float(getattr(acc, 'margin_level', 0))
            }

            self.is_connected = True
            self.current_account = account_data
            return account_data

    def disconnect(self) -> None:
        """Disconnect and clean shutdown MT5 instance."""
        with self._lock:
            if is_mt5_available():
                try:
                    mt5.shutdown()
                except Exception:
                    pass
            self.is_connected = False
            self.current_account = None

    def get_snapshot(self) -> Dict[str, Any]:
        """
        Extract live account metrics and active open positions snapshot.
        """
        if not is_mt5_available():
            raise RuntimeError("MetaTrader5 library is not installed.")

        with self._lock:
            if not self.is_connected:
                raise RuntimeError("MT5 session is not connected.")

            acc = mt5.account_info()
            if acc is not None:
                mode_val = int(getattr(acc, 'trade_mode', -1) or 0)
                trade_mode = {0: 'DEMO', 1: 'CONTEST', 2: 'LIVE'}.get(mode_val, 'UNKNOWN')
                self.current_account = {
                    'accountKey': f"{acc.login}@{acc.server}",
                    'login': str(acc.login),
                    'name': str(getattr(acc, 'name', '') or ''),
                    'server': str(getattr(acc, 'server', '') or ''),
                    'company': str(getattr(acc, 'company', '') or ''),
                    'currency': str(getattr(acc, 'currency', 'USD') or 'USD'),
                    'leverage': int(getattr(acc, 'leverage', 0) or 0),
                    'tradeMode': trade_mode,
                    'tradeAllowed': bool(getattr(acc, 'trade_allowed', False)),
                    'tradeExpert': bool(getattr(acc, 'trade_expert', False)),
                    'balance': safe_float(getattr(acc, 'balance', 0)),
                    'credit': safe_float(getattr(acc, 'credit', 0)),
                    'profit': safe_float(getattr(acc, 'profit', 0)),
                    'equity': safe_float(getattr(acc, 'equity', 0)),
                    'margin': safe_float(getattr(acc, 'margin', 0)),
                    'marginFree': safe_float(getattr(acc, 'margin_free', 0)),
                    'marginLevel': safe_float(getattr(acc, 'margin_level', 0))
                }

            positions_raw = mt5.positions_get() or ()
            positions = []
            for p in positions_raw:
                p_type = int(getattr(p, 'type', 0) or 0)
                side = 'BUY' if p_type == getattr(mt5, 'POSITION_TYPE_BUY', 0) else 'SELL'
                ticket = str(getattr(p, 'ticket', '') or '')
                pos_id = str(getattr(p, 'identifier', '') or ticket)
                positions.append({
                    'ticket': ticket,
                    'positionId': pos_id,
                    'symbol': str(getattr(p, 'symbol', 'UNKNOWN')).upper(),
                    'side': side,
                    'volume': safe_float(getattr(p, 'volume', 0)),
                    'priceOpen': safe_float(getattr(p, 'price_open', 0)),
                    'priceCurrent': safe_float(getattr(p, 'price_current', 0)),
                    'sl': safe_float(getattr(p, 'sl', 0)),
                    'tp': safe_float(getattr(p, 'tp', 0)),
                    'profit': safe_float(getattr(p, 'profit', 0)),
                    'swap': safe_float(getattr(p, 'swap', 0)),
                    'comment': str(getattr(p, 'comment', '') or ''),
                    'time': int(getattr(p, 'time', 0) or 0)
                })

            t_info = mt5.terminal_info()
            v_info = mt5.version()
            terminal_data = {
                'name': 'MetaTrader 5',
                'build': int(v_info[1]) if v_info and len(v_info) > 1 else 0,
                'connected': bool(getattr(t_info, 'connected', True)) if t_info else False,
                'tradeAllowed': bool(getattr(t_info, 'trade_allowed', False)) if t_info else False
            }

            floating_pnl = sum(p['profit'] + p['swap'] for p in positions)

            return {
                'account': self.current_account,
                'positions': positions,
                'openTradesCount': len(positions),
                'floatingPnl': round(floating_pnl, 2),
                'terminal': terminal_data,
                'updatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            }
