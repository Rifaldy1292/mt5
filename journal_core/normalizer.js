/**
 * Normalizer utilities to sanitize and standardize trade and cashflow payloads.
 */

function cleanNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clampString(val, maxLen = 255) {
  return String(val || '').trim().slice(0, maxLen);
}

function normalizeTrade(raw) {
  const side = String(raw.side || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
  const entry = cleanNumber(raw.entry);
  const exit = cleanNumber(raw.exit);
  const sl = cleanNumber(raw.sl);
  const tp = cleanNumber(raw.tp);
  const lots = Math.max(0.01, cleanNumber(raw.lots, 0.01));
  const pnl = cleanNumber(raw.pnl);

  // Auto calculate R-Multiple if not provided
  let rMultiple = cleanNumber(raw.rMultiple, NaN);
  if (!Number.isFinite(rMultiple)) {
    const risk = Math.abs(entry - sl);
    const reward = side === 'BUY' ? (exit - entry) : (entry - exit);
    rMultiple = (sl > 0 && risk > 0) ? Number((reward / risk).toFixed(2)) : 0;
  }

  const openedAt = raw.openedAt ? new Date(raw.openedAt).toISOString() : new Date().toISOString();
  const closedAt = raw.closedAt ? new Date(raw.closedAt).toISOString() : null;

  return {
    id: clampString(raw.id || `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 64),
    accountKey: clampString(raw.accountKey || 'DEFAULT_ACCOUNT', 120),
    positionId: raw.positionId ? clampString(raw.positionId, 64) : null,
    dealId: raw.dealId ? clampString(raw.dealId, 64) : null,
    symbol: clampString(raw.symbol || 'XAUUSD', 20).toUpperCase(),
    side,
    entry,
    exit,
    sl,
    tp,
    lots,
    pnl,
    grossProfit: cleanNumber(raw.grossProfit, pnl),
    commission: cleanNumber(raw.commission, 0),
    swap: cleanNumber(raw.swap, 0),
    fee: cleanNumber(raw.fee, 0),
    rMultiple,
    status: ['OPEN', 'PENDING_CLOSE', 'CLOSED'].includes(String(raw.status || '').toUpperCase())
      ? String(raw.status).toUpperCase()
      : (closedAt ? 'CLOSED' : 'OPEN'),
    closeReason: clampString(raw.closeReason || 'UNKNOWN', 40),
    openedAt,
    closedAt,
    durationSeconds: cleanNumber(raw.durationSeconds, 0),
    setup: clampString(raw.setup || 'Uncategorized', 80),
    timeframe: clampString(raw.timeframe || 'M15', 10).toUpperCase(),
    session: clampString(raw.session || 'All Sessions', 30),
    notes: clampString(raw.notes || '', 2000),
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => clampString(t, 40)) : []
  };
}

function normalizeCashflow(raw) {
  const allowed = new Set(['DEPOSIT', 'WITHDRAWAL', 'CREDIT', 'BONUS', 'CHARGE', 'CORRECTION']);
  const type = allowed.has(String(raw.type || '').toUpperCase()) ? String(raw.type).toUpperCase() : 'DEPOSIT';
  let amount = cleanNumber(raw.amount, 0);

  if (type === 'WITHDRAWAL' || type === 'CHARGE') {
    amount = -Math.abs(amount);
  } else if (['DEPOSIT', 'CREDIT', 'BONUS'].includes(type)) {
    amount = Math.abs(amount);
  }

  return {
    id: clampString(raw.id || `cash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 64),
    accountKey: clampString(raw.accountKey || 'DEFAULT_ACCOUNT', 120),
    type,
    amount: Number(amount.toFixed(2)),
    currency: clampString(raw.currency || 'USD', 10).toUpperCase(),
    at: raw.at ? new Date(raw.at).toISOString() : new Date().toISOString(),
    comment: clampString(raw.comment || '', 300),
    dealId: raw.dealId ? clampString(raw.dealId, 64) : null
  };
}

module.exports = {
  cleanNumber,
  clampString,
  normalizeTrade,
  normalizeCashflow
};
