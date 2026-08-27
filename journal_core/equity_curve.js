/**
 * Equity Curve and Breakdown Engine
 * Generates time-series data for charting equity growth, drawdown curves, daily PnL, and monthly tables.
 */
const { cleanNumber } = require('./normalizer');

function generateEquityCurve(trades = [], initialBalance = 10000, cashflows = []) {
  const closed = trades.filter(t => t.status === 'CLOSED' && t.closedAt);
  const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));

  // Merge closed trades and cashflow timeline events
  const timeline = [];

  for (const c of cashflows) {
    timeline.push({
      time: c.at,
      type: 'CASHFLOW',
      amount: c.amount
    });
  }

  for (const t of sorted) {
    timeline.push({
      time: t.closedAt,
      type: 'TRADE',
      amount: t.pnl
    });
  }

  timeline.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

  let runningBalance = cleanNumber(initialBalance, 10000);
  let cumulativeProfit = 0;
  let peak = runningBalance;

  const points = [
    {
      time: timeline.length > 0 ? timeline[0].time : new Date().toISOString(),
      balance: runningBalance,
      equity: runningBalance,
      pnl: 0,
      cumulativeProfit: 0,
      drawdownPct: 0
    }
  ];

  for (const item of timeline) {
    runningBalance += item.amount;
    if (item.type === 'TRADE') {
      cumulativeProfit += item.amount;
    }

    if (runningBalance > peak) {
      peak = runningBalance;
    }

    const ddAmount = peak - runningBalance;
    const drawdownPct = peak > 0 ? Number(((ddAmount / peak) * 100).toFixed(2)) : 0;

    points.push({
      time: item.time,
      balance: Number(runningBalance.toFixed(2)),
      equity: Number(runningBalance.toFixed(2)),
      pnl: Number(item.amount.toFixed(2)),
      cumulativeProfit: Number(cumulativeProfit.toFixed(2)),
      drawdownPct
    });
  }

  return points;
}

function generateMonthlyBreakdown(trades = [], initialBalance = 10000, cashflows = []) {
  const closed = trades.filter(t => t.status === 'CLOSED' && t.closedAt);
  const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));

  const monthKeys = new Set();
  sorted.forEach(t => monthKeys.add(t.closedAt.slice(0, 7)));
  cashflows.forEach(c => monthKeys.add(c.at.slice(0, 7)));

  const sortedMonths = Array.from(monthKeys).sort();
  let currentBal = cleanNumber(initialBalance, 10000);

  const months = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const ym of sortedMonths) {
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;

    const monthTrades = sorted.filter(t => t.closedAt.startsWith(ym));
    const monthFlows = cashflows.filter(c => c.at.startsWith(ym));

    const startingBalance = currentBal;
    const netProfit = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = monthTrades.filter(t => t.pnl > 0).length;
    const winRate = monthTrades.length > 0 ? Number(((wins / monthTrades.length) * 100).toFixed(1)) : 0;

    const deposits = monthFlows.filter(c => c.amount > 0).reduce((sum, c) => sum + c.amount, 0);
    const withdrawals = Math.abs(monthFlows.filter(c => c.amount < 0).reduce((sum, c) => sum + c.amount, 0));

    const gainPct = startingBalance > 0 ? Number(((netProfit / startingBalance) * 100).toFixed(2)) : 0;
    const endingBalance = startingBalance + deposits - withdrawals + netProfit;

    months.push({
      month: `${monthNames[monthIndex]} ${year}`,
      year,
      monthIndex,
      startingBalance: Number(startingBalance.toFixed(2)),
      endingBalance: Number(endingBalance.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      gainPct,
      tradesCount: monthTrades.length,
      winRate,
      deposits: Number(deposits.toFixed(2)),
      withdrawals: Number(withdrawals.toFixed(2))
    });

    currentBal = endingBalance;
  }

  return months;
}

function generateDailyPnL(trades = []) {
  const closed = trades.filter(t => t.status === 'CLOSED' && t.closedAt);
  const daily = {};

  for (const t of closed) {
    const day = t.closedAt.slice(0, 10);
    if (!daily[day]) {
      daily[day] = { date: day, pnl: 0, trades: 0, wins: 0, losses: 0 };
    }
    daily[day].pnl = Number((daily[day].pnl + t.pnl).toFixed(2));
    daily[day].trades++;
    if (t.pnl > 0) daily[day].wins++;
    else if (t.pnl < 0) daily[day].losses++;
  }

  return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  generateEquityCurve,
  generateMonthlyBreakdown,
  generateDailyPnL
};
