// src/lib/calculations/stats.ts
// Core trading performance calculations

import type { Trade, DashboardStats, PerformanceByDimension } from '@/types/trade';

/**
 * Calculate comprehensive dashboard stats from an array of trades
 */
export function calcDashboardStats(trades: Trade[]): DashboardStats {
  const closed = trades.filter(t => t.result !== undefined && t.result !== null);
  const wins = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');
  const breakevenTrades = closed.filter(t => t.result === 'breakeven');

  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

  const grossPnl = closed.reduce((sum, t) => sum + (t.gross_pnl ?? t.net_pnl ?? 0), 0);
  const totalFee = closed.reduce((sum, t) => sum + (t.fee ?? 0) + (t.funding_fee ?? 0), 0);
  const netPnl = closed.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0);

  const totalWinAmount = wins.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0);
  const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0));

  const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;

  const profitFactor = totalLossAmount > 0
    ? totalWinAmount / totalLossAmount
    : wins.length > 0 ? Infinity : 0;

  // Expectancy = (WR * avgWin) - (LR * avgLoss)
  const winRate01 = winRate / 100;
  const lossRate01 = 1 - winRate01;
  const expectancy = (winRate01 * avgWin) - (lossRate01 * avgLoss);

  const maxDrawdown = calcMaxDrawdown(closed);

  const bestTrade = closed.reduce((b, t) =>
    (t.net_pnl ?? 0) > (b?.net_pnl ?? -Infinity) ? t : b, null as Trade | null);
  const worstTrade = closed.reduce((b, t) =>
    (t.net_pnl ?? 0) < (b?.net_pnl ?? Infinity) ? t : b, null as Trade | null);

  // Best/worst pair
  const byPair = groupByDimension(closed, t => t.symbol);
  const sortedPairs = Object.values(byPair).sort((a, b) => b.net_pnl - a.net_pnl);
  const bestPair = sortedPairs[0]?.label ?? '-';
  const worstPair = sortedPairs[sortedPairs.length - 1]?.label ?? '-';

  // Best/worst strategy
  const byStrategy = groupByDimension(closed, t => t.strategy_name ?? 'Unknown');
  const sortedStrategies = Object.values(byStrategy).sort((a, b) => b.net_pnl - a.net_pnl);
  const bestStrategy = sortedStrategies[0]?.label ?? '-';
  const worstStrategy = sortedStrategies[sortedStrategies.length - 1]?.label ?? '-';

  return {
    total_trades: closed.length,
    winning_trades: wins.length,
    losing_trades: losses.length,
    breakeven_trades: breakevenTrades.length,
    win_rate: parseFloat(winRate.toFixed(1)),
    gross_pnl: parseFloat(grossPnl.toFixed(2)),
    net_pnl: parseFloat(netPnl.toFixed(2)),
    total_fee: parseFloat(totalFee.toFixed(2)),
    avg_win: parseFloat(avgWin.toFixed(2)),
    avg_loss: parseFloat(avgLoss.toFixed(2)),
    profit_factor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
    best_trade_pnl: parseFloat((bestTrade?.net_pnl ?? 0).toFixed(2)),
    worst_trade_pnl: parseFloat((worstTrade?.net_pnl ?? 0).toFixed(2)),
    best_pair: bestPair,
    worst_pair: worstPair,
    best_strategy: bestStrategy,
    worst_strategy: worstStrategy,
  };
}

/**
 * Calculate maximum drawdown from a series of trades (chronological order)
 */
export function calcMaxDrawdown(trades: Trade[]): number {
  if (trades.length === 0) return 0;

  let peak = 0;
  let equity = 0;
  let maxDD = 0;

  for (const trade of trades) {
    equity += (trade.net_pnl ?? 0);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  return maxDD;
}

/**
 * Build equity curve data for charting
 */
export function buildEquityCurve(
  trades: Trade[],
  startingBalance = 10000
): Array<{ date: string; equity: number; pnl: number }> {
  let equity = startingBalance;
  return trades
    .filter(t => t.net_pnl !== undefined)
    .sort((a, b) => new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime())
    .map(t => {
      equity += (t.net_pnl ?? 0);
      return {
        date: new Date(t.entry_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
        equity: parseFloat(equity.toFixed(2)),
        pnl: t.net_pnl ?? 0,
      };
    });
}

/**
 * Group trades by a dimension key and compute performance per group
 */
type DimensionMap = Record<string, { label: string; total: number; wins: number; losses: number; net_pnl: number }>;

function groupByDimension(trades: Trade[], keyFn: (t: Trade) => string): DimensionMap {
  return trades.reduce((acc, t) => {
    const key = keyFn(t);
    if (!acc[key]) acc[key] = { label: key, total: 0, wins: 0, losses: 0, net_pnl: 0 };
    acc[key].total++;
    if (t.result === 'win') acc[key].wins++;
    if (t.result === 'loss') acc[key].losses++;
    acc[key].net_pnl += (t.net_pnl ?? 0);
    return acc;
  }, {} as DimensionMap);
}

export function calcPerformanceByDimension(
  trades: Trade[],
  keyFn: (t: Trade) => string
): PerformanceByDimension[] {
  const map = groupByDimension(trades, keyFn);
  return Object.values(map).map(g => ({
    label: g.label,
    total: g.total,
    wins: g.wins,
    losses: g.losses,
    win_rate: g.total > 0 ? parseFloat(((g.wins / g.total) * 100).toFixed(1)) : 0,
    gross_pnl: parseFloat(g.net_pnl.toFixed(2)),
    net_pnl: parseFloat(g.net_pnl.toFixed(2)),
    avg_pnl: parseFloat((g.net_pnl / g.total).toFixed(2)),
  })).sort((a, b) => b.net_pnl - a.net_pnl);
}

/**
 * Calculate R-Multiple: actual P/L / risk amount
 */
export function calcRMultiple(netPnl: number, riskAmount: number): number | null {
  if (!riskAmount || riskAmount === 0) return null;
  return parseFloat((netPnl / riskAmount).toFixed(2));
}

/**
 * Check if a trade violates user's trading rules
 */
export function checkRuleViolations(
  trade: Partial<Trade>,
  rules: {
    max_risk_per_trade_pct?: number;
    allowed_pairs?: string[];
    allowed_hours_start?: string;
    allowed_hours_end?: string;
    max_daily_loss?: number;
  }
): string[] {
  const violations: string[] = [];

  if (rules.max_risk_per_trade_pct && trade.risk_percent) {
    if (trade.risk_percent > rules.max_risk_per_trade_pct) {
      violations.push(`risk_exceeded: ${trade.risk_percent}% > ${rules.max_risk_per_trade_pct}%`);
    }
  }

  if (rules.allowed_pairs && rules.allowed_pairs.length > 0 && trade.symbol) {
    if (!rules.allowed_pairs.includes(trade.symbol)) {
      violations.push(`pair_not_allowed: ${trade.symbol}`);
    }
  }

  if (rules.allowed_hours_start && rules.allowed_hours_end && trade.entry_at) {
    const entryTime = new Date(trade.entry_at).toTimeString().slice(0, 5);
    if (entryTime < rules.allowed_hours_start || entryTime > rules.allowed_hours_end) {
      violations.push(`outside_trading_hours: ${entryTime}`);
    }
  }

  return violations;
}
