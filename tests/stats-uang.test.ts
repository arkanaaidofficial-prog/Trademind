// tests/stats-uang.test.ts
// Metrik UANG di dashboard. Fokus: jangan sampai "tidak ada datanya"
// diam-diam dihitung sebagai "nol dolar".

import { describe, it, expect } from 'vitest'
import {
  calcDashboardStats,
  calcMaxDrawdown,
  buildEquityCurve,
  calcPerformanceByDimension,
} from '@/lib/calculations/stats'
import { tr, trBot } from './helper'

describe('trade tanpa P/L uang tidak boleh dihitung sebagai nol dolar', () => {
  // Bot-futures mengirim `result` + `r_multiple` tapi TIDAK PERNAH `net_pnl`
  // (dia tidak tahu modal Bapak). Kalau baris itu ikut masuk pembagi,
  // rata-rata menang/kalah tertarik ke nol tanpa satu pun tanda bahaya.

  it('avg_win hanya dari kemenangan yang P/L-nya tercatat', () => {
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'win', net_pnl: 100 }),
      trBot({ result: 'win' }), // r_multiple ada, net_pnl TIDAK
    ])
    expect(s.avg_win).toBe(100)
  })

  it('avg_loss hanya dari kekalahan yang P/L-nya tercatat', () => {
    const s = calcDashboardStats([
      tr({ result: 'loss', net_pnl: -50 }),
      trBot({ result: 'loss' }),
    ])
    expect(s.avg_loss).toBe(50)
  })

  it('melaporkan berapa trade selesai yang P/L uangnya belum ada', () => {
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      trBot({ result: 'win' }),
      trBot({ result: 'loss' }),
    ])
    expect(s.total_trades).toBe(3)       // tetap dihitung sebagai trade
    expect(s.trades_dengan_pnl).toBe(1)  // tapi hanya 1 yang punya angka uang
    expect(s.trades_tanpa_pnl).toBe(2)
  })

  it('total_fee hanya dari baris yang P/L-nya ada', () => {
    // bot-futures menulis FEE_PULANG_PERGI_PCT (0,1 = persen) ke kolom
    // `fee` yang satuannya dolar. Selama baris itu tidak punya net_pnl,
    // angka persen itu tidak boleh ikut dijumlah jadi "Total Fee $".
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100, fee: 5 }),
      trBot({ result: 'win', fee: 0.1, funding_fee: 0.0125 }),
    ])
    expect(s.total_fee).toBe(5)
  })

  it('win_rate tetap memakai SEMUA trade selesai, termasuk yang tanpa P/L', () => {
    // Sengaja: hasil menang/kalah bot diketahui pasti, hanya nominalnya yang tidak.
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      trBot({ result: 'loss' }),
    ])
    expect(s.win_rate).toBe(50)
  })
})

describe('kelas untung/rugi kas', () => {
  it('breakeven tepat nol bukan kemenangan kas', () => {
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'breakeven', net_pnl: 0 }),
    ])
    expect(s.avg_win).toBe(100)
  })

  it('breakeven tepat nol bukan kerugian kas', () => {
    const s = calcDashboardStats([
      tr({ result: 'loss', net_pnl: -40 }),
      tr({ result: 'breakeven', net_pnl: 0 }),
    ])
    expect(s.avg_loss).toBe(40)
  })
})

describe('max drawdown', () => {
  // Empat trade. Urutan ENTRY dan urutan EXIT berbeda (bukan sekadar
  // kebalikan), jadi dua urutan itu memberi drawdown yang berbeda.
  const A = tr({ entry_at: '2026-01-01T00:00:00Z', exit_at: '2026-01-20T00:00:00Z', result: 'win', net_pnl: 10 })
  const B = tr({ entry_at: '2026-01-02T00:00:00Z', exit_at: '2026-01-03T00:00:00Z', result: 'loss', net_pnl: -8 })
  const C = tr({ entry_at: '2026-01-03T00:00:00Z', exit_at: '2026-01-25T00:00:00Z', result: 'win', net_pnl: 3 })
  const D = tr({ entry_at: '2026-01-04T00:00:00Z', exit_at: '2026-01-05T00:00:00Z', result: 'loss', net_pnl: -8 })

  // urutan entry : +10, -8, +3, -8 -> ekuitas 10, 2, 5, -3 -> drawdown 13
  // urutan exit  : -8, -8, +10, +3 -> ekuitas -8, -16, -6, -3 -> drawdown 16
  it('diukur pada urutan REALISASI (exit), bukan urutan entry', () => {
    expect(calcMaxDrawdown([A, B, C, D])).toBe(16)
  })

  it('tidak bergantung pada urutan array yang diberikan pemanggil', () => {
    // Halaman trades memuat `entry_at desc`, dashboard `entry_at asc`.
    // Angka yang sama harus keluar dari keduanya.
    expect(calcMaxDrawdown([D, C, B, A])).toBe(16)
    expect(calcMaxDrawdown([C, A, D, B])).toBe(16)
  })

  it('trade tanpa P/L tidak menggeser kurva ekuitas', () => {
    // null DAN undefined harus sama-sama tersaring. `x + null` diam-diam
    // sama dengan `x`, jadi kalau hanya null yang diuji, penyaring yang
    // dihapus tidak akan ketahuan. `x + undefined` menghasilkan NaN.
    expect(calcMaxDrawdown([A, B, C, D, trBot({ result: 'loss' })])).toBe(16)
    expect(calcMaxDrawdown([A, B, C, D, tr({ result: 'loss', net_pnl: undefined })])).toBe(16)
  })
})

describe('expectancy', () => {
  it('breakeven bukan kekalahan', () => {
    // 2 menang +100, 1 kalah -50, 1 breakeven 0.
    // Jati diri yang harus dipenuhi: expectancy == total P/L / jumlah trade.
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'loss', net_pnl: -50 }),
      tr({ result: 'breakeven', net_pnl: 0 }),
    ])
    expect(s.expectancy).toBe(37.5) // 150 / 4
  })

  it('pembaginya trade yang P/L-nya ada, bukan semua trade selesai', () => {
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'loss', net_pnl: -50 }),
      trBot({ result: 'win' }), // tidak punya nominal -> tidak ikut membagi
    ])
    expect(s.expectancy).toBe(25) // 50 / 2, bukan 50 / 3
  })

  it('sama dengan rata-rata P/L per trade pada contoh apa pun', () => {
    const contoh = [
      tr({ result: 'win', net_pnl: 220 }),
      tr({ result: 'loss', net_pnl: -40 }),
      tr({ result: 'loss', net_pnl: -60 }),
      tr({ result: 'breakeven', net_pnl: -1 }),
      tr({ result: 'win', net_pnl: 31 }),
    ]
    const s = calcDashboardStats(contoh)
    const rata = (220 - 40 - 60 - 1 + 31) / 5
    expect(s.expectancy).toBeCloseTo(rata, 6)
  })
})

describe('profit factor', () => {
  it('bernilai null kalau belum ada kekalahan, bukan Infinity', () => {
    // Infinity hilang jadi null begitu `stats_snapshot` ditulis ke JSONB
    // reviews — angka berubah diam-diam saat disimpan.
    const s = calcDashboardStats([tr({ result: 'win', net_pnl: 100 })])
    expect(s.profit_factor).toBeNull()
    expect(JSON.parse(JSON.stringify(s)).profit_factor).toBe(s.profit_factor)
  })

  it('dihitung dari tanda P/L, bukan dari label hasil', () => {
    // Trade berlabel "win" tapi net_pnl negatif (fee memakan TP kecil)
    // adalah kerugian kas. Profit factor adalah rasio kas.
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'win', net_pnl: -10 }),
      tr({ result: 'loss', net_pnl: -40 }),
    ])
    expect(s.profit_factor).toBe(2) // 100 / 50
  })
})

describe('trade terbaik / terburuk', () => {
  it('trade tanpa P/L tidak boleh jadi "trade terbaik" hanya karena dibaca nol', () => {
    // Semua trade rugi, satu baris bot tanpa P/L. Dengan `?? 0` baris bot
    // menang jadi yang terbaik dengan $0 — padahal angkanya tidak ada.
    const s = calcDashboardStats([
      tr({ result: 'loss', net_pnl: -50 }),
      tr({ result: 'loss', net_pnl: -20 }),
      trBot({ result: 'win' }),
    ])
    expect(s.best_trade_pnl).toBe(-20)
    expect(s.worst_trade_pnl).toBe(-50)
  })

  it('semua trade untung: yang terburuk tetap yang terkecil, bukan nol', () => {
    const s = calcDashboardStats([
      tr({ result: 'win', net_pnl: 100 }),
      tr({ result: 'win', net_pnl: 20 }),
    ])
    expect(s.worst_trade_pnl).toBe(20)
    expect(s.best_trade_pnl).toBe(100)
  })

  it('satu pair saja tidak boleh jadi yang terbaik SEKALIGUS terburuk', () => {
    const s = calcDashboardStats([
      tr({ symbol: 'BTCUSDT', result: 'win', net_pnl: 100 }),
      tr({ symbol: 'BTCUSDT', result: 'loss', net_pnl: -10 }),
    ])
    expect(s.best_pair).toBe('BTCUSDT')
    expect(s.worst_pair).toBe('-')
  })
})

describe('kurva ekuitas', () => {
  it('tidak memasukkan trade yang P/L-nya belum ada', () => {
    const titik = buildEquityCurve([
      tr({ result: 'win', net_pnl: 100, exit_at: '2026-01-02T00:00:00Z' }),
      tr({ result: 'loss', net_pnl: -50, exit_at: '2026-01-03T00:00:00Z' }),
      trBot({ result: 'win', exit_at: '2026-01-04T00:00:00Z' }),
    ])
    expect(titik).toHaveLength(2)
  })

  it('diurutkan pada waktu realisasi, bukan waktu entry', () => {
    const titik = buildEquityCurve(
      [
        tr({ entry_at: '2026-01-01T00:00:00Z', exit_at: '2026-01-20T00:00:00Z', result: 'win', net_pnl: 10 }),
        tr({ entry_at: '2026-01-02T00:00:00Z', exit_at: '2026-01-03T00:00:00Z', result: 'loss', net_pnl: -8 }),
      ],
      0,
    )
    expect(titik.map(t => t.equity)).toEqual([-8, 2])
  })
})

describe('performa per dimensi', () => {
  it('gross_pnl adalah gross, bukan salinan net', () => {
    const baris = calcPerformanceByDimension(
      [tr({ symbol: 'ETHUSDT', result: 'win', gross_pnl: 100, fee: 10, net_pnl: 90 })],
      t => t.symbol,
    )
    expect(baris[0].gross_pnl).toBe(100)
    expect(baris[0].net_pnl).toBe(90)
  })

  it('win_rate tidak dibagi dengan posisi yang masih terbuka', () => {
    const baris = calcPerformanceByDimension(
      [
        tr({ symbol: 'ETHUSDT', result: 'win', net_pnl: 50 }),
        tr({ symbol: 'ETHUSDT' }), // masih terbuka: belum punya result
      ],
      t => t.symbol,
    )
    expect(baris[0].total).toBe(2)
    expect(baris[0].win_rate).toBe(100)
  })

  it('avg_pnl tidak membagi dengan trade yang P/L-nya belum ada', () => {
    const baris = calcPerformanceByDimension(
      [
        tr({ symbol: 'ETHUSDT', result: 'win', net_pnl: 90 }),
        trBot({ symbol: 'ETHUSDT', result: 'win' }),
      ],
      t => t.symbol,
    )
    expect(baris[0].total).toBe(2)
    expect(baris[0].avg_pnl).toBe(90)
  })
})
