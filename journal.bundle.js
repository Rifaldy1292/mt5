var JournalCore = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // journal_core/normalizer.js
  var require_normalizer = __commonJS({
    "journal_core/normalizer.js"(exports, module) {
      function cleanNumber(val, fallback = 0) {
        const n = Number(val);
        return Number.isFinite(n) ? n : fallback;
      }
      function clampString(val, maxLen = 255) {
        return String(val || "").trim().slice(0, maxLen);
      }
      function normalizeTrade(raw) {
        const side = String(raw.side || "").toUpperCase() === "SELL" ? "SELL" : "BUY";
        const entry = cleanNumber(raw.entry);
        const exit = cleanNumber(raw.exit);
        const sl = cleanNumber(raw.sl);
        const tp = cleanNumber(raw.tp);
        const lots = Math.max(0.01, cleanNumber(raw.lots, 0.01));
        const pnl = cleanNumber(raw.pnl);
        let rMultiple = cleanNumber(raw.rMultiple, NaN);
        if (!Number.isFinite(rMultiple)) {
          const risk = Math.abs(entry - sl);
          const reward = side === "BUY" ? exit - entry : entry - exit;
          rMultiple = sl > 0 && risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
        }
        const openedAt = raw.openedAt ? new Date(raw.openedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        const closedAt = raw.closedAt ? new Date(raw.closedAt).toISOString() : null;
        return {
          id: clampString(raw.id || `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 64),
          accountKey: clampString(raw.accountKey || "DEFAULT_ACCOUNT", 120),
          positionId: raw.positionId ? clampString(raw.positionId, 64) : null,
          dealId: raw.dealId ? clampString(raw.dealId, 64) : null,
          symbol: clampString(raw.symbol || "XAUUSD", 20).toUpperCase(),
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
          status: ["OPEN", "PENDING_CLOSE", "CLOSED"].includes(String(raw.status || "").toUpperCase()) ? String(raw.status).toUpperCase() : closedAt ? "CLOSED" : "OPEN",
          closeReason: clampString(raw.closeReason || "UNKNOWN", 40),
          openedAt,
          closedAt,
          durationSeconds: cleanNumber(raw.durationSeconds, 0),
          setup: clampString(raw.setup || "Uncategorized", 80),
          timeframe: clampString(raw.timeframe || "M15", 10).toUpperCase(),
          session: clampString(raw.session || "All Sessions", 30),
          notes: clampString(raw.notes || "", 2e3),
          tags: Array.isArray(raw.tags) ? raw.tags.map((t) => clampString(t, 40)) : []
        };
      }
      function normalizeCashflow(raw) {
        const allowed = /* @__PURE__ */ new Set(["DEPOSIT", "WITHDRAWAL", "CREDIT", "BONUS", "CHARGE", "CORRECTION"]);
        const type = allowed.has(String(raw.type || "").toUpperCase()) ? String(raw.type).toUpperCase() : "DEPOSIT";
        let amount = cleanNumber(raw.amount, 0);
        if (type === "WITHDRAWAL" || type === "CHARGE") {
          amount = -Math.abs(amount);
        } else if (["DEPOSIT", "CREDIT", "BONUS"].includes(type)) {
          amount = Math.abs(amount);
        }
        return {
          id: clampString(raw.id || `cash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 64),
          accountKey: clampString(raw.accountKey || "DEFAULT_ACCOUNT", 120),
          type,
          amount: Number(amount.toFixed(2)),
          currency: clampString(raw.currency || "USD", 10).toUpperCase(),
          at: raw.at ? new Date(raw.at).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
          comment: clampString(raw.comment || "", 300),
          dealId: raw.dealId ? clampString(raw.dealId, 64) : null
        };
      }
      module.exports = {
        cleanNumber,
        clampString,
        normalizeTrade,
        normalizeCashflow
      };
    }
  });

  // journal_core/analytics.js
  var require_analytics = __commonJS({
    "journal_core/analytics.js"(exports, module) {
      var { cleanNumber } = require_normalizer();
      function calculateJournalAnalytics(trades = [], profile = {}, cashflows = []) {
        const closed = trades.filter((t) => String(t.status || "CLOSED").toUpperCase() === "CLOSED" && t.closedAt);
        const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
        const totalTrades = sorted.length;
        const wins = sorted.filter((t) => t.pnl > 0).length;
        const losses = sorted.filter((t) => t.pnl < 0).length;
        const breakEven = totalTrades - wins - losses;
        const winRate = totalTrades > 0 ? Number((wins / totalTrades * 100).toFixed(1)) : 0;
        const grossProfit = sorted.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(sorted.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
        const netPnl = sorted.reduce((sum, t) => sum + t.pnl, 0);
        const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0;
        const avgWin = wins > 0 ? Number((grossProfit / wins).toFixed(2)) : 0;
        const avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(2)) : 0;
        const winProb = totalTrades > 0 ? wins / totalTrades : 0;
        const lossProb = totalTrades > 0 ? losses / totalTrades : 0;
        const expectancy = Number((winProb * avgWin - lossProb * avgLoss).toFixed(2));
        const rList = sorted.map((t) => cleanNumber(t.rMultiple, 0)).filter((r) => r !== 0);
        const avgR = rList.length > 0 ? Number((rList.reduce((a, b) => a + b, 0) / rList.length).toFixed(2)) : 0;
        let maxWinStreak = 0, currentWinStreak = 0;
        let maxLossStreak = 0, currentLossStreak = 0;
        let lastStreakType = "NONE";
        let lastStreakCount = 0;
        for (const t of sorted) {
          if (t.pnl > 0) {
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
            lastStreakType = "WIN";
            lastStreakCount = currentWinStreak;
          } else if (t.pnl < 0) {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
            lastStreakType = "LOSS";
            lastStreakCount = currentLossStreak;
          }
        }
        const initialBalance = Math.max(0, cleanNumber(profile.initialBalance, 1e4));
        const deposits = cashflows.filter((c) => c.amount > 0).reduce((s, c) => s + c.amount, 0);
        const withdrawals = Math.abs(cashflows.filter((c) => c.amount < 0).reduce((s, c) => s + c.amount, 0));
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
            const ddPct = peak > 0 ? ddAmount / peak * 100 : 0;
            if (ddAmount > maxDrawdownAmount) maxDrawdownAmount = ddAmount;
            if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
          }
        }
        const longs = sorted.filter((t) => t.side === "BUY");
        const shorts = sorted.filter((t) => t.side === "SELL");
        const longWins = longs.filter((t) => t.pnl > 0).length;
        const shortWins = shorts.filter((t) => t.pnl > 0).length;
        const longWinRate = longs.length > 0 ? Number((longWins / longs.length * 100).toFixed(1)) : 0;
        const shortWinRate = shorts.length > 0 ? Number((shortWins / shorts.length * 100).toFixed(1)) : 0;
        const pnlList = sorted.map((t) => t.pnl);
        const bestTradePnl = pnlList.length > 0 ? Math.max(...pnlList) : 0;
        const worstTradePnl = pnlList.length > 0 ? Math.min(...pnlList) : 0;
        const durations = sorted.map((t) => cleanNumber(t.durationSeconds, 0)).filter((d) => d > 0);
        const avgDurationMinutes = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60) : 0;
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
    }
  });

  // journal_core/trader_dna.js
  var require_trader_dna = __commonJS({
    "journal_core/trader_dna.js"(exports, module) {
      var { cleanNumber } = require_normalizer();
      function clampScore(val) {
        return Math.max(0, Math.min(100, Math.round(cleanNumber(val, 0))));
      }
      function calculateTraderDNA(trades = [], stats = {}) {
        const closed = trades.filter((t) => t.status === "CLOSED" && t.closedAt);
        const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
        if (sorted.length === 0) {
          return {
            overall: 50,
            grade: "C",
            dimensions: {
              consistency: 50,
              profitability: 50,
              riskManagement: 50,
              discipline: 50,
              resilience: 50
            },
            stopLossUsagePct: 0,
            martingaleRatePct: 0,
            revengeTradeCount: 0,
            findings: [{ level: "warn", title: "Data Belum Cukup", detail: "Catat atau sinkronkan minimal 5 transaksi untuk menghasilkan analisis Trader DNA." }]
          };
        }
        const pf = stats.profitFactor || 0;
        const wr = stats.winRate || 0;
        const pfScore = Math.min(100, pf / 2.5 * 100);
        const wrScore = Math.min(100, wr / 65 * 100);
        const expScore = (stats.expectancy || 0) > 0 ? Math.min(100, 55 + Math.log10(1 + Math.abs(stats.expectancy || 0)) * 18) : Math.max(0, 50 + (stats.expectancy || 0));
        const profitability = clampScore(pfScore * 0.4 + wrScore * 0.35 + expScore * 0.25);
        const stopLossCount = sorted.filter((t) => cleanNumber(t.sl, 0) > 0).length;
        const stopLossUsagePct = Number((stopLossCount / sorted.length * 100).toFixed(1));
        const ddScore = Math.max(0, 100 - (stats.maxDrawdownPct || 0) * 3);
        const lossWinRatio = (stats.avgLoss || 0) > 0 ? Math.min(100, (stats.avgWin || 0) / (stats.avgLoss || 1) * 55) : 100;
        const riskManagement = clampScore(stopLossUsagePct * 0.45 + ddScore * 0.35 + lossWinRatio * 0.2);
        let afterLossCount = 0;
        let lotEscalatedCount = 0;
        let revengeCount = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const cur = sorted[i];
          if (prev.pnl < 0) {
            afterLossCount++;
            if (cur.lots > prev.lots * 1.25) {
              lotEscalatedCount++;
            }
            const gapMinutes = (Date.parse(cur.openedAt) - Date.parse(prev.closedAt)) / 6e4;
            if (gapMinutes >= 0 && gapMinutes <= 10 && cur.lots >= prev.lots) {
              revengeCount++;
            }
          }
        }
        const martingaleRatePct = afterLossCount > 0 ? Number((lotEscalatedCount / afterLossCount * 100).toFixed(1)) : 0;
        const discipline = clampScore(
          stopLossUsagePct * 0.4 + Math.max(0, 100 - martingaleRatePct * 1.5) * 0.35 + Math.max(0, 100 - revengeCount * 12) * 0.25
        );
        const dailyMap = {};
        for (const t of sorted) {
          const day = t.closedAt.slice(0, 10);
          dailyMap[day] = (dailyMap[day] || 0) + t.pnl;
        }
        const days = Object.values(dailyMap);
        const winDays = days.filter((pnl) => pnl > 0).length;
        const dayWinRate = days.length > 0 ? winDays / days.length * 100 : 50;
        const consistency = clampScore(dayWinRate * 0.6 + wr * 0.4);
        const lossStreak = stats.maxLossStreak || 0;
        const streakScore = Math.max(0, 100 - lossStreak * 6);
        const recoveryScore = pf >= 1 ? Math.min(100, 50 + pf * 20) : Math.max(0, pf * 50);
        const resilience = clampScore(recoveryScore * 0.5 + streakScore * 0.5);
        const dimensions = {
          consistency,
          profitability,
          riskManagement,
          discipline,
          resilience
        };
        const overall = clampScore(
          (consistency + profitability + riskManagement + discipline + resilience) / 5
        );
        const grade = overall >= 90 ? "A+" : overall >= 85 ? "A" : overall >= 80 ? "A-" : overall >= 75 ? "B+" : overall >= 70 ? "B" : overall >= 65 ? "B-" : overall >= 60 ? "C+" : overall >= 55 ? "C" : overall >= 45 ? "D" : "E";
        const findings = [];
        if (stopLossUsagePct < 70) {
          findings.push({
            level: "risk",
            title: "Stop Loss Jarang Digunakan",
            detail: `Stop loss hanya terpasang pada ${stopLossUsagePct}% transaksi. Pasang SL pada setiap entri untuk menjaga batas risiko terukur.`
          });
        }
        if (martingaleRatePct >= 25) {
          findings.push({
            level: "risk",
            title: "Pola Martingale Terdeteksi",
            detail: `Pada ${martingaleRatePct}% transaksi setelah loss, ukuran lot dinaikkan >25%. Hindari memperbesar lot agresif untuk menutup kerugian.`
          });
        }
        if (revengeCount >= 2) {
          findings.push({
            level: "risk",
            title: "Revenge Trading Cepat",
            detail: `Terdeteksi ${revengeCount}x re-entry terburu-buru (\u226410 menit) setelah mengalami loss. Berikan jeda waktu untuk menenangkan psikologi.`
          });
        }
        if ((stats.maxDrawdownPct || 0) >= 20) {
          findings.push({
            level: "warn",
            title: "Drawdown Mendekati Batas Risiko",
            detail: `Max drawdown mencapai ${stats.maxDrawdownPct}%. Kurangi resiko per trade atau terapkan max daily loss.`
          });
        }
        if (pf >= 1.5) {
          findings.push({
            level: "good",
            title: "Profit Factor Sehat",
            detail: `Profit factor ${pf.toFixed(2)} membuktikan perolehan gross profit melampaui gross loss secara konsisten.`
          });
        }
        if (wr >= 55) {
          findings.push({
            level: "good",
            title: "Win Rate Stabil",
            detail: `Win rate ${wr.toFixed(1)}% berada di atas rata-rata benchmark trader institusi.`
          });
        }
        return {
          overall,
          grade,
          dimensions,
          stopLossUsagePct,
          martingaleRatePct,
          revengeTradeCount: revengeCount,
          findings: findings.slice(0, 6)
        };
      }
      module.exports = {
        calculateTraderDNA
      };
    }
  });

  // journal_core/equity_curve.js
  var require_equity_curve = __commonJS({
    "journal_core/equity_curve.js"(exports, module) {
      var { cleanNumber } = require_normalizer();
      function generateEquityCurve(trades = [], initialBalance = 1e4, cashflows = []) {
        const closed = trades.filter((t) => t.status === "CLOSED" && t.closedAt);
        const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
        const timeline = [];
        for (const c of cashflows) {
          timeline.push({
            time: c.at,
            type: "CASHFLOW",
            amount: c.amount
          });
        }
        for (const t of sorted) {
          timeline.push({
            time: t.closedAt,
            type: "TRADE",
            amount: t.pnl
          });
        }
        timeline.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
        let runningBalance = cleanNumber(initialBalance, 1e4);
        let cumulativeProfit = 0;
        let peak = runningBalance;
        const points = [
          {
            time: timeline.length > 0 ? timeline[0].time : (/* @__PURE__ */ new Date()).toISOString(),
            balance: runningBalance,
            equity: runningBalance,
            pnl: 0,
            cumulativeProfit: 0,
            drawdownPct: 0
          }
        ];
        for (const item of timeline) {
          runningBalance += item.amount;
          if (item.type === "TRADE") {
            cumulativeProfit += item.amount;
          }
          if (runningBalance > peak) {
            peak = runningBalance;
          }
          const ddAmount = peak - runningBalance;
          const drawdownPct = peak > 0 ? Number((ddAmount / peak * 100).toFixed(2)) : 0;
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
      function generateMonthlyBreakdown(trades = [], initialBalance = 1e4, cashflows = []) {
        const closed = trades.filter((t) => t.status === "CLOSED" && t.closedAt);
        const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
        const monthKeys = /* @__PURE__ */ new Set();
        sorted.forEach((t) => monthKeys.add(t.closedAt.slice(0, 7)));
        cashflows.forEach((c) => monthKeys.add(c.at.slice(0, 7)));
        const sortedMonths = Array.from(monthKeys).sort();
        let currentBal = cleanNumber(initialBalance, 1e4);
        const months = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (const ym of sortedMonths) {
          const [yearStr, monthStr] = ym.split("-");
          const year = parseInt(yearStr, 10);
          const monthIndex = parseInt(monthStr, 10) - 1;
          const monthTrades = sorted.filter((t) => t.closedAt.startsWith(ym));
          const monthFlows = cashflows.filter((c) => c.at.startsWith(ym));
          const startingBalance = currentBal;
          const netProfit = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
          const wins = monthTrades.filter((t) => t.pnl > 0).length;
          const winRate = monthTrades.length > 0 ? Number((wins / monthTrades.length * 100).toFixed(1)) : 0;
          const deposits = monthFlows.filter((c) => c.amount > 0).reduce((sum, c) => sum + c.amount, 0);
          const withdrawals = Math.abs(monthFlows.filter((c) => c.amount < 0).reduce((sum, c) => sum + c.amount, 0));
          const gainPct = startingBalance > 0 ? Number((netProfit / startingBalance * 100).toFixed(2)) : 0;
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
        const closed = trades.filter((t) => t.status === "CLOSED" && t.closedAt);
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
    }
  });

  // journal_core/index.js
  var require_index = __commonJS({
    "journal_core/index.js"(exports, module) {
      var { normalizeTrade, normalizeCashflow } = require_normalizer();
      var { calculateJournalAnalytics } = require_analytics();
      var { calculateTraderDNA } = require_trader_dna();
      var { generateEquityCurve, generateMonthlyBreakdown, generateDailyPnL } = require_equity_curve();
      module.exports = {
        normalizeTrade,
        normalizeCashflow,
        calculateJournalAnalytics,
        calculateTraderDNA,
        generateEquityCurve,
        generateMonthlyBreakdown,
        generateDailyPnL
      };
    }
  });
  return require_index();
})();
