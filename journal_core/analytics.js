/**
 * Core Journal Analytics Engine
 * Computes all statistical metrics from trade history and ledger cashflows.
 */
const { cleanNumber } = require('./normalizer');

function calculateJournalAnalytics(trades = [], profile = {}, cashflows = []) {
  // Only process CLOSED trades for historical performance metrics
  const closed = trades.filter(t => String(t.status || 'CLOSED').toUpperCase() === 'CLOSED' && t.closedAt);
  const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));

  const totalTrades = sorted.length;
  const wins = sorted.filter(t => t.pnl > 0).length;
  const losses = sorted.filter(t => t.pnl < 0).length;
  const breakEven = totalTrades - wins - losses;

  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;

  const grossProfit = sorted.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(sorted.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const netPnl = sorted.reduce((sum, t) => sum + t.pnl, 0);

  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 999.0 : 0.0);

  const avgWin = wins > 0 ? Number((grossProfit / wins).toFixed(2)) : 0;
  const avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(2)) : 0;

  // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
  const winProb = totalTrades > 0 ? wins / totalTrades : 0;
  const lossProb = totalTrades > 0 ? losses / totalTrades : 0;
  const expectancy = Number((winProb * avgWin - lossProb * avgLoss).toFixed(2));

  // Average R-Multiple
  const rList = sorted.map(t => cleanNumber(t.rMultiple, 0)).filter(r => r !== 0);
  const avgR = rList.length > 0 ? Number((rList.reduce((a, b) => a + b, 0) / rList.length).toFixed(2)) : 0;

  // Streaks calculation
  let maxWinStreak = 0, currentWinStreak = 0;
  let maxLossStreak = 0, currentLossStreak = 0;
  let lastStreakType = 'NONE';
  let lastStreakCount = 0;

  for (const t of sorted) {
    if (t.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      lastStreakType = 'WIN';
      lastStreakCount = currentWinStreak;
    } else if (t.pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      lastStreakType = 'LOSS';
      lastStreakCount = currentLossStreak;
    }
  }

  // Drawdown calculation
  const initialBalance = Math.max(0, cleanNumber(profile.initialBalance, 10000));
  const deposits = cashflows.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
  const withdrawals = Math.abs(cashflows.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0));
  const netCashflow = deposits - withdrawals;

  let peak = initialBalance;
  let runningBalance = initialBalance;
  let maxDrawdownAmount = 0;
  let maxDrawdownPct = 0;

  for (const t of sorted) {
    runningBalance += t.pnl;
    if (runningBalance > peak) {
      peak = runningBalance;
    } else {
      const ddAmount = peak - runningBalance;
      const ddPct = peak > 0 ? (ddAmount / peak) * 100 : 0;
      if (ddAmount > maxDrawdownAmount) maxDrawdownAmount = ddAmount;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }
  }

  // Side breakdowns
  const longs = sorted.filter(t => t.side === 'BUY');
  const shorts = sorted.filter(t => t.side === 'SELL');
  const longWins = longs.filter(t => t.pnl > 0).length;
  const shortWins = shorts.filter(t => t.pnl > 0).length;

  const longWinRate = longs.length > 0 ? Number(((longWins / longs.length) * 100).toFixed(1)) : 0;
  const shortWinRate = shorts.length > 0 ? Number(((shortWins / shorts.length) * 100).toFixed(1)) : 0;

  // Best & worst trades
  const pnlList = sorted.map(t => t.pnl);
  const bestTradePnl = pnlList.length > 0 ? Math.max(...pnlList) : 0;
  const worstTradePnl = pnlList.length > 0 ? Math.min(...pnlList) : 0;

  // Average trade duration in minutes
  const durations = sorted.map(t => cleanNumber(t.durationSeconds, 0)).filter(d => d > 0);
  const avgDurationMinutes = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
    : 0;

  const currentBalance = initialBalance + netCashflow + netPnl;
  const floatingPnl = cleanNumber(profile.floatingPnl, 0);
  const currentEquity = currentBalance + floatingPnl;

  return {
    totalTrades,
    wins,
    losses,
    breakEven,
    winRate,
    profitFactor,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    netPnl: Number(netPnl.toFixed(2)),
    avgWin,
    avgLoss,
    avgR,
    expectancy,
    maxWinStreak,
    maxLossStreak,
    currentStreak: { type: lastStreakType, count: lastStreakCount },
    maxDrawdownAmount: Number(maxDrawdownAmount.toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(1)),
    longCount: longs.length,
    longWinRate,
    shortCount: shorts.length,
    shortWinRate,
    bestTradePnl: Number(bestTradePnl.toFixed(2)),
    worstTradePnl: Number(worstTradePnl.toFixed(2)),
    avgDurationMinutes,
    currentBalance: Number(currentBalance.toFixed(2)),
    currentEquity: Number(currentEquity.toFixed(2))
  };
}

module.exports = {
  calculateJournalAnalytics
};
