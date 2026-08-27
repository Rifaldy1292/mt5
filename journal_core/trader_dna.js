/**
 * Trader DNA Intelligence Engine
 * Evaluates behavioral patterns across 5 core dimensions:
 * 1. Consistency
 * 2. Profitability
 * 3. Risk Management
 * 4. Discipline
 * 5. Resilience
 */
const { cleanNumber } = require('./normalizer');

function clampScore(val) {
  return Math.max(0, Math.min(100, Math.round(cleanNumber(val, 0))));
}

function calculateTraderDNA(trades = [], stats = {}) {
  const closed = trades.filter(t => t.status === 'CLOSED' && t.closedAt);
  const sorted = [...closed].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));

  if (sorted.length === 0) {
    return {
      overall: 50,
      grade: 'C',
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
      findings: [{ level: 'warn', title: 'Data Belum Cukup', detail: 'Catat atau sinkronkan minimal 5 transaksi untuk menghasilkan analisis Trader DNA.' }]
    };
  }

  // 1. Profitability Score
  const pf = stats.profitFactor || 0;
  const wr = stats.winRate || 0;
  const pfScore = Math.min(100, (pf / 2.5) * 100);
  const wrScore = Math.min(100, (wr / 65) * 100);
  const expScore = (stats.expectancy || 0) > 0
    ? Math.min(100, 55 + Math.log10(1 + Math.abs(stats.expectancy || 0)) * 18)
    : Math.max(0, 50 + (stats.expectancy || 0));
  const profitability = clampScore(pfScore * 0.40 + wrScore * 0.35 + expScore * 0.25);

  // 2. Risk Management Score
  const stopLossCount = sorted.filter(t => cleanNumber(t.sl, 0) > 0).length;
  const stopLossUsagePct = Number(((stopLossCount / sorted.length) * 100).toFixed(1));
  const ddScore = Math.max(0, 100 - (stats.maxDrawdownPct || 0) * 3.0);
  const lossWinRatio = (stats.avgLoss || 0) > 0
    ? Math.min(100, ((stats.avgWin || 0) / (stats.avgLoss || 1)) * 55)
    : 100;
  const riskManagement = clampScore(stopLossUsagePct * 0.45 + ddScore * 0.35 + lossWinRatio * 0.20);

  // 3. Discipline Score (Detecting Martingale & Revenge Trading)
  let afterLossCount = 0;
  let lotEscalatedCount = 0;
  let revengeCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];

    if (prev.pnl < 0) {
      afterLossCount++;
      // Lot raised by >25% immediately after loss
      if (cur.lots > prev.lots * 1.25) {
        lotEscalatedCount++;
      }
      // Re-entry in <= 10 minutes after a loss
      const gapMinutes = (Date.parse(cur.openedAt) - Date.parse(prev.closedAt)) / 60000;
      if (gapMinutes >= 0 && gapMinutes <= 10 && cur.lots >= prev.lots) {
        revengeCount++;
      }
    }
  }

  const martingaleRatePct = afterLossCount > 0 ? Number(((lotEscalatedCount / afterLossCount) * 100).toFixed(1)) : 0;
  const discipline = clampScore(
    stopLossUsagePct * 0.40 +
    Math.max(0, 100 - martingaleRatePct * 1.5) * 0.35 +
    Math.max(0, 100 - revengeCount * 12) * 0.25
  );

  // 4. Consistency Score
  // Group by day to measure daily profit stability
  const dailyMap = {};
  for (const t of sorted) {
    const day = t.closedAt.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + t.pnl;
  }
  const days = Object.values(dailyMap);
  const winDays = days.filter(pnl => pnl > 0).length;
  const dayWinRate = days.length > 0 ? (winDays / days.length) * 100 : 50;
  const consistency = clampScore(dayWinRate * 0.60 + wr * 0.40);

  // 5. Resilience Score (Recovering from losing streaks)
  const lossStreak = stats.maxLossStreak || 0;
  const streakScore = Math.max(0, 100 - lossStreak * 6);
  const recoveryScore = pf >= 1.0 ? Math.min(100, 50 + pf * 20) : Math.max(0, pf * 50);
  const resilience = clampScore(recoveryScore * 0.50 + streakScore * 0.50);

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

  const grade = overall >= 90 ? 'A+'
    : overall >= 85 ? 'A'
    : overall >= 80 ? 'A-'
    : overall >= 75 ? 'B+'
    : overall >= 70 ? 'B'
    : overall >= 65 ? 'B-'
    : overall >= 60 ? 'C+'
    : overall >= 55 ? 'C'
    : overall >= 45 ? 'D' : 'E';

  // Qualitative findings
  const findings = [];
  if (stopLossUsagePct < 70) {
    findings.push({
      level: 'risk',
      title: 'Stop Loss Jarang Digunakan',
      detail: `Stop loss hanya terpasang pada ${stopLossUsagePct}% transaksi. Pasang SL pada setiap entri untuk menjaga batas risiko terukur.`
    });
  }
  if (martingaleRatePct >= 25) {
    findings.push({
      level: 'risk',
      title: 'Pola Martingale Terdeteksi',
      detail: `Pada ${martingaleRatePct}% transaksi setelah loss, ukuran lot dinaikkan >25%. Hindari memperbesar lot agresif untuk menutup kerugian.`
    });
  }
  if (revengeCount >= 2) {
    findings.push({
      level: 'risk',
      title: 'Revenge Trading Cepat',
      detail: `Terdeteksi ${revengeCount}x re-entry terburu-buru (≤10 menit) setelah mengalami loss. Berikan jeda waktu untuk menenangkan psikologi.`
    });
  }
  if ((stats.maxDrawdownPct || 0) >= 20) {
    findings.push({
      level: 'warn',
      title: 'Drawdown Mendekati Batas Risiko',
      detail: `Max drawdown mencapai ${stats.maxDrawdownPct}%. Kurangi resiko per trade atau terapkan max daily loss.`
    });
  }
  if (pf >= 1.5) {
    findings.push({
      level: 'good',
      title: 'Profit Factor Sehat',
      detail: `Profit factor ${pf.toFixed(2)} membuktikan perolehan gross profit melampaui gross loss secara konsisten.`
    });
  }
  if (wr >= 55) {
    findings.push({
      level: 'good',
      title: 'Win Rate Stabil',
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
