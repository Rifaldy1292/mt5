/**
 * Svelte Reactive Store for Trading Journal Data & Intelligence
 * Computes derived analytics, equity curve, monthly breakdown, and trader DNA.
 */
import { writable, derived } from 'svelte/store';
import {
  calculateJournalAnalytics,
  calculateTraderDNA,
  generateEquityCurve,
  generateMonthlyBreakdown,
  normalizeTrade,
  normalizeCashflow
} from '../journal_core/index.js';
import { defaultApiClient } from './apiClient.js';
import mockData from './mockData.json';

export function createJournalStore(apiClient = defaultApiClient) {
  const trades = writable((mockData.closedTrades || []).map(normalizeTrade));
  const cashflows = writable((mockData.cashflows || []).map(normalizeCashflow));
  const profile = writable({
    initialBalance: mockData.initialBalance || 10000,
    currency: 'USD',
    floatingPnl: 0
  });

  const filters = writable({
    symbol: 'ALL',
    side: 'ALL',
    setup: 'ALL',
    timeframe: 'ALL',
    searchQuery: '',
    startDate: '',
    endDate: ''
  });

  // Filtered trades derived store
  const filteredTrades = derived([trades, filters], ([$trades, $filters]) => {
    return $trades.filter(t => {
      if ($filters.symbol !== 'ALL' && t.symbol !== $filters.symbol) return false;
      if ($filters.side !== 'ALL' && t.side !== $filters.side) return false;
      if ($filters.setup !== 'ALL' && t.setup !== $filters.setup) return false;
      if ($filters.timeframe !== 'ALL' && t.timeframe !== $filters.timeframe) return false;

      if ($filters.startDate && t.closedAt && t.closedAt < $filters.startDate) return false;
      if ($filters.endDate && t.closedAt && t.closedAt > $filters.endDate) return false;

      if ($filters.searchQuery) {
        const q = $filters.searchQuery.toLowerCase();
        const matchSymbol = t.symbol.toLowerCase().includes(q);
        const matchNotes = (t.notes || '').toLowerCase().includes(q);
        const matchSetup = (t.setup || '').toLowerCase().includes(q);
        if (!matchSymbol && !matchNotes && !matchSetup) return false;
      }
      return true;
    });
  });

  // Derived Analytics
  const analytics = derived([filteredTrades, profile, cashflows], ([$trades, $profile, $cashflows]) => {
    return calculateJournalAnalytics($trades, $profile, $cashflows);
  });

  // Derived Trader DNA
  const traderDna = derived([filteredTrades, analytics], ([$trades, $analytics]) => {
    return calculateTraderDNA($trades, $analytics);
  });

  // Derived Equity Curve Points
  const equityCurve = derived([filteredTrades, profile, cashflows], ([$trades, $profile, $cashflows]) => {
    return generateEquityCurve($trades, $profile.initialBalance, $cashflows);
  });

  // Derived Monthly Reports
  const monthlyBreakdown = derived([filteredTrades, profile, cashflows], ([$trades, $profile, $cashflows]) => {
    return generateMonthlyBreakdown($trades, $profile.initialBalance, $cashflows);
  });

  // Action: Sync History from Live MT5
  async function syncFromMT5(days = 60) {
    try {
      const history = await apiClient.getHistory(days);
      if (history && history.closedTrades) {
        const normalized = history.closedTrades.map(normalizeTrade);
        trades.set(normalized);
      }
      if (history && history.cashflows) {
        const flows = history.cashflows.map(normalizeCashflow);
        cashflows.set(flows);
      }
      return true;
    } catch (err) {
      console.error('[journalStore] syncFromMT5 failed:', err.message);
      return false;
    }
  }

  // Action: Add / Edit manual trade
  function saveTrade(rawTrade) {
    const trade = normalizeTrade(rawTrade);
    trades.update(list => {
      const idx = list.findIndex(t => t.id === trade.id);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = trade;
        return copy;
      }
      return [trade, ...list];
    });
  }

  // Action: Delete trade
  function deleteTrade(tradeId) {
    trades.update(list => list.filter(t => t.id !== tradeId));
  }

  // Action: Export to CSV
  function exportCSV() {
    let rawTrades = [];
    trades.subscribe(v => (rawTrades = v))();

    const headers = ['ID', 'Symbol', 'Side', 'Entry', 'Exit', 'SL', 'TP', 'Lots', 'PnL', 'R:Multiple', 'Close Reason', 'Opened At', 'Closed At', 'Notes'];
    const rows = rawTrades.map(t => [
      t.id,
      t.symbol,
      t.side,
      t.entry,
      t.exit,
      t.sl,
      t.tp,
      t.lots,
      t.pnl,
      t.rMultiple,
      t.closeReason || '',
      t.openedAt,
      t.closedAt || '',
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csvContent;
  }

  return {
    trades,
    cashflows,
    profile,
    filters,
    filteredTrades,
    analytics,
    traderDna,
    equityCurve,
    monthlyBreakdown,
    syncFromMT5,
    saveTrade,
    deleteTrade,
    exportCSV
  };
}

export const journal = createJournalStore();
