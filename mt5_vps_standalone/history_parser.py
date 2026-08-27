"""
History Parser Module (VPS Edition)
Extracts and reconstructs deals & orders into clean Closed Trade objects,
Open Positions with real-time updates, and Cashflows (deposits/withdrawals).
"""
from __future__ import annotations
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None


def float_val(val: Any, default: float = 0.0) -> float:
    try:
        x = float(val)
        return x if math.isfinite(x) else default
    except Exception:
        return default


def iso_time(ts: Any) -> str:
    try:
        return datetime.fromtimestamp(int(ts), timezone.utc).isoformat().replace('+00:00', 'Z')
    except Exception:
        return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def get_close_reason(deal: Any) -> str:
    """Map MT5 deal close reasons to standard labels."""
    reason = int(getattr(deal, 'reason', -999) or -999)
    mapping = {
        0: 'MANUAL_DESKTOP',    # DEAL_REASON_CLIENT
        1: 'MANUAL_MOBILE',     # DEAL_REASON_MOBILE
        2: 'MANUAL_WEB',        # DEAL_REASON_WEB
        3: 'EXPERT_API',        # DEAL_REASON_EXPERT
        4: 'STOP_LOSS',         # DEAL_REASON_SL
        5: 'TAKE_PROFIT',       # DEAL_REASON_TP
        6: 'STOP_OUT',          # DEAL_REASON_SO
        7: 'ROLLOVER',
        8: 'VARIATION_MARGIN',
        9: 'SPLIT',
        10: 'CORPORATE_ACTION'
    }
    return mapping.get(reason, 'BROKER_CLOSE')


def extract_trading_history(days: int = 60, account_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Fetch history deals and orders from MT5 and group them by position ID.
    Returns:
      - closedTrades: List of completed trade lifecycles with pnl, fees, entry, exit, duration
      - cashflows: Deposits, withdrawals, and balance adjustments
      - openPositions: Currently active trades
    """
    if mt5 is None:
        raise RuntimeError("MetaTrader5 package is not available.")

    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=max(1, min(int(days), 3650)))

    deals = list(mt5.history_deals_get(start_time, end_time) or ())
    orders = list(mt5.history_orders_get(start_time, end_time) or ())
    positions = list(mt5.positions_get() or [])

    # Map orders by position ID to retrieve original SL / TP
    order_map: Dict[int, List[Any]] = {}
    for o in orders:
        pid = int(getattr(o, 'position_id', 0) or getattr(o, 'position_by_id', 0) or 0)
        if pid:
            order_map.setdefault(pid, []).append(o)

    # Group deals by position ID
    deal_groups: Dict[int, List[Any]] = {}
    for d in deals:
        pid = int(getattr(d, 'position_id', 0) or 0)
        if pid:
            deal_groups.setdefault(pid, []).append(d)

    open_ids = {int(getattr(p, 'ticket', 0) or 0) for p in positions}
    open_ids.update({int(getattr(p, 'identifier', 0) or 0) for p in positions})

    closed_trades = []
    account_key = account_info.get('accountKey', 'MT5') if account_info else 'MT5'

    # Reconstruct closed trades
    for pid, rows in deal_groups.items():
        if pid in open_ids:
            continue

        entries = [d for d in rows if getattr(d, 'entry', None) in (mt5.DEAL_ENTRY_IN, mt5.DEAL_ENTRY_INOUT)]
        exits = [d for d in rows if getattr(d, 'entry', None) in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY, mt5.DEAL_ENTRY_INOUT)]

        if not entries or not exits:
            continue

        entry_vol = sum(max(0, float_val(getattr(d, 'volume', 0))) for d in entries)
        exit_vol = sum(max(0, float_val(getattr(d, 'volume', 0))) for d in exits)

        if exit_vol <= 0:
            continue

        first_entry = sorted(entries, key=lambda x: getattr(x, 'time', 0))[0]
        last_exit = sorted(exits, key=lambda x: getattr(x, 'time', 0))[-1]

        avg_entry_price = sum(float_val(d.price) * float_val(d.volume) for d in entries) / max(entry_vol, 1e-12)
        avg_exit_price = sum(float_val(d.price) * float_val(d.volume) for d in exits) / max(exit_vol, 1e-12)

        profit = sum(float_val(getattr(d, 'profit', 0)) for d in rows)
        swap = sum(float_val(getattr(d, 'swap', 0)) for d in rows)
        commission = sum(float_val(getattr(d, 'commission', 0)) for d in rows)
        fee = sum(float_val(getattr(d, 'fee', 0)) for d in rows)
        net_pnl = profit + swap + commission + fee

        side = 'BUY' if getattr(first_entry, 'type', None) == mt5.DEAL_TYPE_BUY else 'SELL'

        # Find initial SL & TP from linked orders
        pos_orders = order_map.get(pid, [])
        sl = next((float_val(getattr(o, 'sl', 0)) for o in pos_orders if float_val(getattr(o, 'sl', 0)) > 0), 0.0)
        tp = next((float_val(getattr(o, 'tp', 0)) for o in pos_orders if float_val(getattr(o, 'tp', 0)) > 0), 0.0)

        risk = abs(avg_entry_price - sl) if sl > 0 else 0.0
        reward = (avg_exit_price - avg_entry_price) if side == 'BUY' else (avg_entry_price - avg_exit_price)
        r_multiple = round(reward / risk, 2) if risk > 0 else 0.0

        open_dt = datetime.fromtimestamp(getattr(first_entry, 'time', 0), timezone.utc)
        close_dt = datetime.fromtimestamp(getattr(last_exit, 'time', 0), timezone.utc)
        duration_seconds = max(0, int((close_dt - open_dt).total_seconds()))

        closed_trades.append({
            'id': f"mt5-{pid}",
            'accountKey': account_key,
            'positionId': str(pid),
            'dealId': str(getattr(last_exit, 'ticket', '') or ''),
            'symbol': str(getattr(first_entry, 'symbol', 'UNKNOWN')).upper(),
            'side': side,
            'entry': round(avg_entry_price, 5),
            'exit': round(avg_exit_price, 5),
            'sl': round(sl, 5),
            'tp': round(tp, 5),
            'lots': round(exit_vol, 2),
            'pnl': round(net_pnl, 2),
            'grossProfit': round(profit, 2),
            'commission': round(commission, 2),
            'swap': round(swap, 2),
            'fee': round(fee, 2),
            'rMultiple': r_multiple,
            'status': 'CLOSED',
            'closeReason': get_close_reason(last_exit),
            'openedAt': iso_time(getattr(first_entry, 'time', 0)),
            'closedAt': iso_time(getattr(last_exit, 'time', 0)),
            'durationSeconds': duration_seconds,
            'setup': 'MT5 Auto Sync',
            'timeframe': 'M15',
            'session': 'Auto',
            'notes': f'Position #{pid} closed via {get_close_reason(last_exit)}'
        })

    closed_trades.sort(key=lambda x: x['closedAt'])

    # Extract Cashflows (Deposits, Withdrawals)
    cashflows = []
    balance_type = getattr(mt5, 'DEAL_TYPE_BALANCE', 2)
    credit_type = getattr(mt5, 'DEAL_TYPE_CREDIT', 3)
    charge_type = getattr(mt5, 'DEAL_TYPE_CHARGE', 4)
    correction_type = getattr(mt5, 'DEAL_TYPE_CORRECTION', 5)
    bonus_type = getattr(mt5, 'DEAL_TYPE_BONUS', 6)

    for d in deals:
        typ = int(getattr(d, 'type', -999))
        amount = float_val(getattr(d, 'profit', 0))
        kind = None

        if typ == balance_type:
            kind = 'DEPOSIT' if amount >= 0 else 'WITHDRAWAL'
        elif typ == credit_type:
            kind = 'CREDIT' if amount >= 0 else 'CORRECTION'
        elif typ == charge_type:
            kind = 'CHARGE'
        elif typ == correction_type:
            kind = 'CORRECTION'
        elif typ == bonus_type:
            kind = 'BONUS' if amount >= 0 else 'CORRECTION'

        if kind:
            ticket = str(getattr(d, 'ticket', '') or '')
            cashflows.append({
                'id': f"cash-{ticket}",
                'accountKey': account_key,
                'type': kind,
                'amount': round(amount, 2),
                'currency': account_info.get('currency', 'USD') if account_info else 'USD',
                'at': iso_time(getattr(d, 'time', 0)),
                'comment': str(getattr(d, 'comment', '') or ''),
                'dealId': ticket
            })

    cashflows.sort(key=lambda x: x['at'])

    return {
        'closedTrades': closed_trades,
        'cashflows': cashflows,
        'totalClosed': len(closed_trades),
        'totalCashflows': len(cashflows)
    }
