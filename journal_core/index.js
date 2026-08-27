/**
 * Journal Core - Consolidated Export
 */
const { normalizeTrade, normalizeCashflow } = require('./normalizer');
const { calculateJournalAnalytics } = require('./analytics');
const { calculateTraderDNA } = require('./trader_dna');
const { generateEquityCurve, generateMonthlyBreakdown, generateDailyPnL } = require('./equity_curve');

module.exports = {
  normalizeTrade,
  normalizeCashflow,
  calculateJournalAnalytics,
  calculateTraderDNA,
  generateEquityCurve,
  generateMonthlyBreakdown,
  generateDailyPnL
};
