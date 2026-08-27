# pyright: reportMissingImports=false
# type: ignore
"""
MT5 Python Bridge Package
"""
try:
    from .mt5_client import MT5Session, is_mt5_available
    from .history_parser import extract_trading_history
except Exception:
    try:
        from mt5_client import MT5Session, is_mt5_available
        from history_parser import extract_trading_history
    except Exception:
        pass

__all__ = ['MT5Session', 'is_mt5_available', 'extract_trading_history']
