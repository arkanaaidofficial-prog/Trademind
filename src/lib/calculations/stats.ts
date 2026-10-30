// src/lib/calculations/stats.ts
// Core trading performance calculations
//
// Aturan pokok berkas ini (30 Okt 2026):
//
//   "tidak ada angkanya" BUKAN "nol dolar".
//
// bot-futures mengirim `result` dan `r_multiple` tapi TIDAK PERNAH
// `net_pnl` — bot tidak tahu modal pemilik jurnal, jadi dia tidak boleh
// mengarang nominal. Sebelum perbaikan ini setiap baris bot ikut masuk
// pembagi rata-rata uang sebagai $0: avg_win, avg_loss, expectancy, dan
// "trade terbaik" semuanya tertarik ke nol tanpa satu pun tanda bahaya.
//
// Karena itu metrik dipisah dua lapis:
//   - metrik JUMLAH (total_trades, win_rate) memakai semua trade selesai;
//     hasil menang/kalah bot diketahui pasti.
//   - metrik UANG hanya memakai baris yang `net_pnl`-nya benar-benar ada,
//     dan jumlah baris yang dilewati dilaporkan lewat `trades_tanpa_pnl`.

import type { Trade, DashboardStats, PerformanceByDimension } from '@/types/trade';

/** Waktu sebuah trade direalisasikan. P/L masuk ke saldo saat KELUAR,
 *  bukan saat masuk — posisi bot bisa menggantung berhari-hari, jadi
 *  urutan entry dan urutan exit bukan permutasi yang sama. */
function waktuRealisasi(t: Trade): number {
  const nilai = new Date(t.exit_at ?? t.entry_at).getTime();
  return Number.isFinite(nilai) ? nilai : 0;
}

function urutRealisasi(a: Trade, b: Trade): number {
  const selisih = waktuRealisasi(a) - waktuRealisasi(b);
  if (selisih !== 0) return selisih;
  // Pengikat seri supaya hasilnya tidak bergantung pada urutan masukan.
  const entri = new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime();
  if (entri !== 0) return entri;
  return String(a.id).localeCompare(String(b.id));
}

/** Baris yang punya angka uang sungguhan. `null` dari Supabase dan
 *  `undefined` dari objek lokal harus sama-sama tersaring. */
function punyaPnl(t: Trade): boolean {
  return t.net_pnl !== undefined && t.net_pnl !== null && Number.isFinite(t.net_pnl);
}

function pnl(t: Trade): number {
  return t.net_pnl as number;
}

function bulat2(n: number): number {
  return parseFloat(n.toFixed(2));
}

/**
 * Calculate comprehensive dashboard stats from an array of trades
 */
export function calcDashboardStats(trades: Trade[]): DashboardStats {
  const closed = trades.filter(t => t.result !== undefined && t.result !== null);
  const wins = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');
  const breakevenTrades = closed.filter(t => t.result === 'breakeven');

  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

  // ─── Lapis UANG ────────────────────────────────────────────────
  const denganPnl = closed.filter(punyaPnl);

  // Untung/rugi kas ditentukan dari TANDA P/L, bukan dari label hasil.
  // Trade berlabel "win" yang net-nya negatif karena fee tetap kerugian kas.
  const kasUntung = denganPnl.filter(t => pnl(t) > 0);
  const kasRugi = denganPnl.filter(t => pnl(t) < 0);

  const totalWinAmount = kasUntung.reduce((sum, t) => sum + pnl(t), 0);
  const totalLossAmount = Math.abs(kasRugi.reduce((sum, t) => sum + pnl(t), 0));

  const grossPnl = denganPnl.reduce((sum, t) => sum + (t.gross_pnl ?? pnl(t)), 0);
  const netPnl = denganPnl.reduce((sum, t) => sum + pnl(t), 0);
  // Fee hanya dijumlah untuk baris yang P/L-nya ada, supaya jembatan
  // "gross - fee = net" di kartu dashboard tetap bisa ditelusuri.
  const totalFee = denganPnl.reduce((sum, t) => sum + (t.fee ?? 0) + (t.funding_fee ?? 0), 0);

  const avgWin = kasUntung.length > 0 ? totalWinAmount / kasUntung.length : 0;
  const avgLoss = kasRugi.length > 0 ? totalLossAmount / kasRugi.length : 0;

  // null, bukan Infinity: Infinity berubah diam-diam jadi null begitu
  // `stats_snapshot` ditulis ke kolom JSONB di tabel reviews.
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : null;

  // Expectancy = rata-rata P/L per trade yang P/L-nya tercatat.
  // Dengan kelas berbasis tanda, rumus terurai (WR x avgWin) - (LR x avgLoss)
  // identik persis dengan rata-rata ini — tidak ada breakeven yang
  // diam-diam dihitung sebagai kekalahan.
  const expectancy = denganPnl.length > 0 ? netPnl / denganPnl.length : 0;

  const maxDrawdown = calcMaxDrawdown(closed);

  const nilaiPnl = denganPnl.map(pnl);
  const bestTradePnl = nilaiPnl.length > 0 ? Math.max(...nilaiPnl) : 0;
  const worstTradePnl = nilaiPnl.length > 0 ? Math.min(...nilaiPnl) : 0;

  // Best/worst pair
  const sortedPairs = calcPerformanceByDimension(closed, t => t.symbol);
  const bestPair = sortedPairs[0]?.label ?? '-';
  // Satu kelompok tidak boleh jadi yang terbaik sekaligus terburuk.
  const worstPair = sortedPairs.length > 1 ? sortedPairs[sortedPairs.length - 1].label : '-';

  // Best/worst strategy
  const sortedStrategies = calcPerformanceByDimension(closed, t => t.strategy_name ?? 'Unknown');
  const bestStrategy = sortedStrategies[0]?.label ?? '-';
  const worstStrategy = sortedStrategies.length > 1
    ? sortedStrategies[sortedStrategies.length - 1].label
    : '-';

  return {
    total_trades: closed.length,
    winning_trades: wins.length,
    losing_trades: losses.length,
    breakeven_trades: breakevenTrades.length,
    trades_dengan_pnl: denganPnl.length,
    trades_tanpa_pnl: closed.length - denganPnl.length,
    win_rate: parseFloat(winRate.toFixed(1)),
    gross_pnl: bulat2(grossPnl),
    net_pnl: bulat2(netPnl),
    total_fee: bulat2(totalFee),
    avg_win: bulat2(avgWin),
    avg_loss: bulat2(avgLoss),
    profit_factor: profitFactor === null ? null : bulat2(profitFactor),
    expectancy: bulat2(expectancy),
    max_drawdown: bulat2(maxDrawdown),
    best_trade_pnl: bulat2(bestTradePnl),
    worst_trade_pnl: bulat2(worstTradePnl),
    best_pair: bestPair,
    worst_pair: worstPair,
    best_strategy: bestStrategy,
    worst_strategy: worstStrategy,
  };
}

/**
 * Maximum drawdown pada kurva ekuitas TEREALISASI.
 *
 * Fungsi ini mengurutkan sendiri, jadi pemanggil boleh mengirim array
 * dengan urutan apa pun. Dashboard memuat `entry_at asc`, halaman trades
 * memuat `entry_at desc`, dan keduanya harus menghasilkan angka yang sama.
 */
export function calcMaxDrawdown(trades: Trade[]): number {
  const urut = trades.filter(punyaPnl).sort(urutRealisasi);
  if (urut.length === 0) return 0;

  let peak = 0;
  let equity = 0;
  let maxDD = 0;

  for (const trade of urut) {
    equity += pnl(trade);
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
    .filter(punyaPnl)
    .sort(urutRealisasi)
    .map(t => {
      equity += pnl(t);
      return {
        date: new Date(t.exit_at ?? t.entry_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
        equity: bulat2(equity),
        pnl: pnl(t),
      };
    });
}

/**
 * Group trades by a dimension key and compute performance per group
 */
type DimensionGroup = {
  label: string;
  total: number;
  selesai: number;
  wins: number;
  losses: number;
  dengan_pnl: number;
  gross_pnl: number;
  net_pnl: number;
};
type DimensionMap = Record<string, DimensionGroup>;

function groupByDimension(trades: Trade[], keyFn: (t: Trade) => string): DimensionMap {
  return trades.reduce((acc, t) => {
    const key = keyFn(t);
    if (!acc[key]) {
      acc[key] = { label: key, total: 0, selesai: 0, wins: 0, losses: 0, dengan_pnl: 0, gross_pnl: 0, net_pnl: 0 };
    }
    const g = acc[key];
    g.total++;
    if (t.result !== undefined && t.result !== null) g.selesai++;
    if (t.result === 'win') g.wins++;
    if (t.result === 'loss') g.losses++;
    if (punyaPnl(t)) {
      g.dengan_pnl++;
      g.gross_pnl += (t.gross_pnl ?? pnl(t));
      g.net_pnl += pnl(t);
    }
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
    // Pembagi adalah trade yang SUDAH SELESAI. Posisi terbuka tidak punya
    // hasil, memasukkannya hanya menurunkan win rate secara semu.
    win_rate: g.selesai > 0 ? parseFloat(((g.wins / g.selesai) * 100).toFixed(1)) : 0,
    trades_dengan_pnl: g.dengan_pnl,
    gross_pnl: bulat2(g.gross_pnl),
    net_pnl: bulat2(g.net_pnl),
    avg_pnl: g.dengan_pnl > 0 ? bulat2(g.net_pnl / g.dengan_pnl) : 0,
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
