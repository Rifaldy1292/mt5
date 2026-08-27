export type TradeSide = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'PENDING_CLOSE' | 'CLOSED';
export type CashflowType = 'DEPOSIT' | 'WITHDRAWAL' | 'CREDIT' | 'BONUS' | 'CHARGE' | 'CORRECTION';

export interface Trade {
  id: string;
  accountKey: string;
  positionId?: string;
  dealId?: string;
  symbol: string;
  side: TradeSide;
  entry: number;
  exit: number;
  sl: number;
  tp: number;
  lots: number;
  pnl: number;
  grossProfit?: number;
  commission: number;
  swap: number;
  fee: number;
  rMultiple: number;
  status: TradeStatus;
  closeReason?: string;
  openedAt: string;
  closedAt: string | null;
  durationSeconds?: number;
  setup?: string;
  timeframe?: string;
  session?: string;
  notes?: string;
  tags?: string[];
}

export interface Cashflow {
  id: string;
  accountKey: string;
  type: CashflowType;
  amount: number;
  currency: string;
  at: string;
  comment?: string;
  dealId?: string;
}

export interface AccountProfile {
  initialBalance: number;
  deposits?: number;
  withdrawals?: number;
  currency?: string;
  floatingPnl?: number;
}

export interface JournalAnalytics {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  profitFactor: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  avgR: number;
  expectancy: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: { type: 'WIN' | 'LOSS' | 'NONE'; count: number };
  maxDrawdownAmount: number;
  maxDrawdownPct: number;
  longCount: number;
  longWinRate: number;
  shortCount: number;
  shortWinRate: number;
  bestTradePnl: number;
  worstTradePnl: number;
  avgDurationMinutes: number;
  currentBalance: number;
  currentEquity: number;
}

export interface TraderDNAFindings {
  level: 'good' | 'warn' | 'risk';
  title: string;
  detail: string;
}

export interface TraderDNA {
  overall: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'E';
  dimensions: {
    consistency: number;
    profitability: number;
    riskManagement: number;
    discipline: number;
    resilience: number;
  };
  stopLossUsagePct: number;
  martingaleRatePct: number;
  revengeTradeCount: number;
  findings: TraderDNAFindings[];
}

export interface EquityPoint {
  time: string;
  balance: number;
  equity: number;
  pnl: number;
  cumulativeProfit: number;
  drawdownPct: number;
}

export interface MonthlyBreakdown {
  month: string;
  year: number;
  monthIndex: number;
  startingBalance: number;
  endingBalance: number;
  netProfit: number;
  gainPct: number;
  tradesCount: number;
  winRate: number;
  deposits: number;
  withdrawals: number;
}
