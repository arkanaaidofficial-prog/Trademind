// tests/stats-r.test.ts
//
// R-multiple adalah SATU-SATUNYA bahasa kinerja yang dipakai bot-futures.
// Sebelum berkas ini ada, kolom `r_multiple` cuma dibaca di satu baris
// teks halaman detail trade — nol metrik agregat memakainya. Artinya
// seluruh hasil kerja bot tidak pernah masuk ringkasan apa pun.
//
// R juga satu-satunya satuan yang menyamakan trade manual Bapak dengan
// trade bot: posisi $50 dan posisi $5.000 sama-sama "+2R" kalau keduanya
// mendapat dua kali yang dipertaruhkan.

import { describe, it, expect } from 'vitest'
import { calcStatistikR, nilaiR, calcPerformanceByDimension } from '@/lib/calculations/stats'
import { tr, trBot } from './helper'

/** lima trade bot: +2,0 / -1,0 / +0,5 / -1,0 / +3,0 (urut waktu keluar) */
function limaTradeBot() {
  const r = [2.0, -1.0, 0.5, -1.0, 3.0]
  return r.map((nilai, i) =>
    trBot({
      result: nilai > 0 ? 'win' : 'loss',
      r_multiple: nilai,
      entry_at: `2026-03-0${i + 1}T00:00:00Z`,
      exit_at: `2026-03-0${i + 2}T00:00:00Z`,
    }),
  )
}

describe('nilai R satu trade', () => {
  it('memakai r_multiple kalau ada', () => {
    expect(nilaiR(trBot({ r_multiple: 2.4 }))).toBe(2.4)
  })

  it('diturunkan dari net_pnl / risk_amount kalau r_multiple kosong', () => {
    // Supaya trade manual Bapak ikut terbaca dalam R tanpa perlu diisi ulang.
    expect(nilaiR(tr({ net_pnl: 150, risk_amount: 100 }))).toBe(1.5)
  })

  it('null kalau risiko tidak diketahui — bukan nol', () => {
    expect(nilaiR(tr({ net_pnl: 150 }))).toBeNull()
    expect(nilaiR(tr({ net_pnl: 150, risk_amount: 0 }))).toBeNull()
    expect(nilaiR(tr({}))).toBeNull()
  })
})

describe('statistik R', () => {
  it('menghitung trade bot yang TIDAK punya P/L uang sama sekali', () => {
    const s = calcStatistikR(limaTradeBot())
    expect(s.trades_dengan_r).toBe(5)
    expect(s.total_r).toBe(3.5)
  })

  it('avg_r adalah expectancy dalam R', () => {
    const s = calcStatistikR(limaTradeBot())
    expect(s.avg_r).toBe(0.7) // 3,5 / 5
  })

  it('rata-rata menang dan kalah dipisah', () => {
    const s = calcStatistikR(limaTradeBot())
    expect(s.avg_r_menang).toBeCloseTo(1.83, 2) // (2,0 + 0,5 + 3,0) / 3
    expect(s.avg_r_kalah).toBe(1) // besaran, bukan negatif
    expect(s.payoff_r).toBeCloseTo(1.83, 2)
  })

  it('jati diri: avg_r == WR x avgMenang - LR x avgKalah', () => {
    const s = calcStatistikR(limaTradeBot())
    const wr = s.win_rate_r / 100
    expect(wr * s.avg_r_menang - (1 - wr) * s.avg_r_kalah).toBeCloseTo(s.avg_r, 6)
  })

  it('profit factor R dari jumlah R, bukan dari jumlah trade', () => {
    const s = calcStatistikR(limaTradeBot())
    expect(s.profit_factor_r).toBe(2.75) // 5,5 / 2,0
  })

  it('win rate R ditentukan tanda R, dan R nol bukan kemenangan', () => {
    const s = calcStatistikR([
      trBot({ r_multiple: 1 }),
      trBot({ r_multiple: 0 }),
    ])
    expect(s.win_rate_r).toBe(50)
  })

  it('R tepat nol juga bukan kekalahan', () => {
    // Tanpa tes ini, menggeser penyaring kalah dari r<0 ke r<=0 tidak
    // ketahuan: R nol ikut jadi "kekalahan sebesar nol" dan menyeret
    // rata-rata kekalahan ke bawah.
    const s = calcStatistikR([
      trBot({ r_multiple: 2, exit_at: '2026-07-01T00:00:00Z' }),
      trBot({ r_multiple: 0, exit_at: '2026-07-02T00:00:00Z' }),
      trBot({ r_multiple: -1, exit_at: '2026-07-03T00:00:00Z' }),
    ])
    expect(s.avg_r_kalah).toBe(1)
    expect(s.payoff_r).toBe(2)
  })

  it('drawdown R memakai puncak awal nol, bukan R pertama', () => {
    // Kalau trade pertama RUGI, puncaknya tetap nol — penurunan dari
    // titik nol itu drawdown sungguhan.
    const s = calcStatistikR([
      trBot({ r_multiple: -1, exit_at: '2026-08-01T00:00:00Z' }),
      trBot({ r_multiple: 2, exit_at: '2026-08-02T00:00:00Z' }),
    ])
    expect(s.max_drawdown_r).toBe(1)
  })

  it('drawdown R diukur pada urutan keluar', () => {
    // ekuitas R: 2 / 1 / 1,5 / 0,5 / 3,5 -> puncak 2, lembah 0,5
    expect(calcStatistikR(limaTradeBot()).max_drawdown_r).toBe(1.5)
  })

  it('drawdown R tidak bergantung urutan array masukan', () => {
    // CATATAN: .reverse() TIDAK cukup di sini. Drawdown maksimum sama
    // dengan jumlah sub-barisan terbesar dari deret yang dinegasikan,
    // dan nilai itu kebal terhadap pembalikan — tes yang cuma membalik
    // akan hijau walau pengurutannya dibuang. Harus permutasi sungguhan.
    const asli = limaTradeBot() // urutan keluar: +2 / -1 / +0,5 / -1 / +3
    const permutasi = [asli[1], asli[4], asli[0], asli[3], asli[2]]
    // tanpa diurutkan ekuitasnya -1 / 2 / 4 / 3 / 3,5 -> drawdown cuma 1
    expect(calcStatistikR(permutasi).max_drawdown_r).toBe(1.5)
  })

  it('profit factor R null kalau belum ada kekalahan', () => {
    const s = calcStatistikR([trBot({ r_multiple: 2 })])
    expect(s.profit_factor_r).toBeNull()
    expect(JSON.parse(JSON.stringify(s)).profit_factor_r).toBe(s.profit_factor_r)
  })

  it('semua nol dan aman saat belum ada data R', () => {
    const s = calcStatistikR([tr({ result: 'win', net_pnl: 100 })])
    expect(s.trades_dengan_r).toBe(0)
    expect(s.avg_r).toBe(0)
    expect(s.profit_factor_r).toBeNull()
    expect(s.payoff_r).toBeNull()
    expect(s.win_rate_r).toBe(0)
    expect(s.wilson_bawah_95).toBeNull()
    expect(s.max_drawdown_r).toBe(0)
  })
})

describe('beruntun kalah / menang', () => {
  it('dihitung pada urutan keluar, bukan urutan array', () => {
    const r = [2, -1, -1, -1, 3]
    const trades = r.map((nilai, i) =>
      trBot({
        r_multiple: nilai,
        entry_at: `2026-04-0${i + 1}T00:00:00Z`,
        exit_at: `2026-04-0${i + 2}T00:00:00Z`,
      }),
    )
    // Permutasi sungguhan, bukan pembalikan: rentetan terpanjang juga
    // kebal terhadap pembalikan.
    const permutasi = [trades[1], trades[4], trades[0], trades[2], trades[3]]
    // tanpa diurutkan rentetan kalah terpanjangnya cuma 2
    const s = calcStatistikR(permutasi)
    expect(s.beruntun_kalah_max).toBe(3)
    expect(s.beruntun_menang_max).toBe(1)
  })

  it('R tepat nol memutus rentetan kekalahan', () => {
    const r = [-1, 0, -1]
    const trades = r.map((nilai, i) =>
      trBot({ r_multiple: nilai, exit_at: `2026-09-0${i + 1}T00:00:00Z` }),
    )
    expect(calcStatistikR(trades).beruntun_kalah_max).toBe(1)
  })

  it('kemenangan memutus rentetan kekalahan', () => {
    const r = [-1, 1, -1, -1]
    const trades = r.map((nilai, i) =>
      trBot({ r_multiple: nilai, exit_at: `2026-10-0${i + 1}T00:00:00Z` }),
    )
    expect(calcStatistikR(trades).beruntun_kalah_max).toBe(2)
  })

  it('beruntun menang terpanjang terbaca', () => {
    const r = [1, 1, 1, 1, -1, 1]
    const trades = r.map((nilai, i) =>
      trBot({
        r_multiple: nilai,
        entry_at: `2026-05-0${i + 1}T00:00:00Z`,
        exit_at: `2026-05-0${i + 2}T00:00:00Z`,
      }),
    )
    expect(calcStatistikR(trades).beruntun_menang_max).toBe(4)
  })
})

describe('kejujuran ukuran sampel', () => {
  // Acuan yang konsisten di seluruh rujukan jurnal trading: di bawah
  // 30 trade, win rate dan expectancy masih didominasi keberuntungan.
  it('menandai sampel belum cukup di bawah 30 trade', () => {
    expect(calcStatistikR(limaTradeBot()).cukup_sampel).toBe(false)
  })

  it('cukup pada 30 trade', () => {
    const banyak = Array.from({ length: 30 }, (_, i) =>
      trBot({ r_multiple: 1, entry_at: `2026-06-01T00:00:00Z`, exit_at: `2026-06-01T00:00:0${i % 10}Z` }),
    )
    expect(calcStatistikR(banyak).cukup_sampel).toBe(true)
  })

  it('batas bawah Wilson 95% jauh di bawah win rate mentah saat sampel kecil', () => {
    // 3 menang dari 5: win rate terlihat 60%, tapi batas bawahnya ~23%.
    const s = calcStatistikR(limaTradeBot())
    expect(s.win_rate_r).toBe(60)
    expect(s.wilson_bawah_95).toBeCloseTo(23.07, 1)
  })

  it('batas bawah Wilson null kalau belum ada trade ber-R', () => {
    expect(calcStatistikR([]).wilson_bawah_95).toBeNull()
  })
})

describe('R per dimensi', () => {
  it('membandingkan bot dan manual dalam satuan yang sama', () => {
    const baris = calcPerformanceByDimension(
      [
        trBot({ mode: 'bot', result: 'win', r_multiple: 2 }),
        trBot({ mode: 'bot', result: 'loss', r_multiple: -1 }),
        tr({ mode: 'manual', result: 'win', net_pnl: 300, risk_amount: 100 }),
      ],
      t => t.mode,
    )
    const bot = baris.find(b => b.label === 'bot')!
    const manual = baris.find(b => b.label === 'manual')!
    expect(bot.trades_dengan_r).toBe(2)
    expect(bot.avg_r).toBe(0.5)
    expect(manual.avg_r).toBe(3)
  })

  it('avg_r dibagi jumlah trade ber-R, bukan jumlah anggota kelompok', () => {
    const baris = calcPerformanceByDimension(
      [
        trBot({ symbol: 'SOLUSDT', result: 'win', r_multiple: 3 }),
        tr({ symbol: 'SOLUSDT', result: 'win', net_pnl: 10 }), // tanpa risk_amount -> tanpa R
      ],
      t => t.symbol,
    )
    expect(baris[0].total).toBe(2)
    expect(baris[0].trades_dengan_r).toBe(1)
    expect(baris[0].avg_r).toBe(3)
  })

  it('avg_r null kalau kelompok itu tidak punya R sama sekali', () => {
    const baris = calcPerformanceByDimension(
      [tr({ symbol: 'ADAUSDT', result: 'win', net_pnl: 10 })],
      t => t.symbol,
    )
    expect(baris[0].trades_dengan_r).toBe(0)
    expect(baris[0].avg_r).toBeNull()
  })
})
