/**
 * Standalone Test Script
 * Runs the full Journal calculation lifecycle and prints the results to the terminal.
 */
const {
  normalizeTrade,
  normalizeCashflow,
  calculateJournalAnalytics,
  calculateTraderDNA,
  generateEquityCurve,
  generateMonthlyBreakdown
} = require('../journal_core/index.js');

const mockData = require('../svelte_adapters/mockData.json');

console.log('====================================================');
console.log('🧪 RUNNING STANDALONE TRADING JOURNAL ENGINE TEST');
console.log('====================================================\n');

// 1. Normalize Trades & Cashflows
const trades = (mockData.closedTrades || []).map(normalizeTrade);
const cashflows = (mockData.cashflows || []).map(normalizeCashflow);
const profile = {
  initialBalance: mockData.initialBalance || 10000,
  floatingPnl: 369.50
};

console.log(`[1] Normalized ${trades.length} closed trades and ${cashflows.length} cashflow records.`);

// 2. Calculate Core Analytics
const stats = calculateJournalAnalytics(trades, profile, cashflows);
console.log('\n📊 JOURNAL ANALYTICS SUMMARY:');
console.log('----------------------------------------------------');
console.log(`• Total Closed Trades : ${stats.totalTrades}`);
console.log(`• Wins / Losses       : ${stats.wins} Wins / ${stats.losses} Losses (${stats.breakEven} Break-even)`);
console.log(`• Win Rate            : ${stats.winRate}%`);
console.log(`• Profit Factor       : ${stats.profitFactor}`);
console.log(`• Gross Profit / Loss : $${stats.grossProfit} / -$${stats.grossLoss}`);
console.log(`• Net Realized P&L    : $${stats.netPnl}`);
console.log(`• Expectancy / Trade  : $${stats.expectancy}`);
console.log(`• Average R:Multiple  : ${stats.avgR}R`);
console.log(`• Max Drawdown        : $${stats.maxDrawdownAmount} (${stats.maxDrawdownPct}%)`);
console.log(`• Best / Worst Trade  : $${stats.bestTradePnl} / $${stats.worstTradePnl}`);
console.log(`• Max Win / Loss Strk : ${stats.maxWinStreak}W / ${stats.maxLossStreak}L`);
console.log(`• Modeled Balance     : $${stats.currentBalance}`);
console.log(`• Modeled Equity      : $${stats.currentEquity}`);

// 3. Calculate Trader DNA
const dna = calculateTraderDNA(trades, stats);
console.log('\n🧬 TRADER DNA ASSESSMENT:');
console.log('----------------------------------------------------');
console.log(`• Overall Score : ${dna.overall}/100 (Grade: ${dna.grade})`);
console.log(`• Dimensions:`);
console.log(`  - Consistency     : ${dna.dimensions.consistency}/100`);
console.log(`  - Profitability   : ${dna.dimensions.profitability}/100`);
console.log(`  - Risk Management : ${dna.dimensions.riskManagement}/100`);
console.log(`  - Discipline      : ${dna.dimensions.discipline}/100`);
console.log(`  - Resilience      : ${dna.dimensions.resilience}/100`);
console.log(`• Key Metrics:`);
console.log(`  - Stop Loss Usage : ${dna.stopLossUsagePct}%`);
console.log(`  - Martingale Rate : ${dna.martingaleRatePct}%`);
console.log(`  - Revenge Trades  : ${dna.revengeTradeCount}`);
console.log(`• Findings:`);
dna.findings.forEach((f, idx) => {
  console.log(`  ${idx + 1}. [${f.level.toUpperCase()}] ${f.title}: ${f.detail}`);
});

// 4. Generate Equity Curve
const curve = generateEquityCurve(trades, profile.initialBalance, cashflows);
console.log(`\n📈 Equity Curve generated with ${curve.length} time points.`);
console.log(`   First Point: $${curve[0].balance} (${curve[0].time})`);
console.log(`   Final Point: $${curve[curve.length - 1].balance} (${curve[curve.length - 1].time})`);

// 5. Generate Monthly Breakdown
const monthly = generateMonthlyBreakdown(trades, profile.initialBalance, cashflows);
console.log('\n📅 MONTHLY PERFORMANCE BREAKDOWN:');
console.log('----------------------------------------------------');
monthly.forEach(m => {
  console.log(`• ${m.month}: Gain ${m.gainPct}% | Net Profit $${m.netProfit} | Trades: ${m.tradesCount} | WinRate: ${m.winRate}%`);
});

console.log('\n====================================================');
console.log('✅ TEST PASSED: All calculations completed successfully!');
console.log('====================================================');
