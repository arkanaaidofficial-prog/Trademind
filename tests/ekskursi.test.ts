// tests/ekskursi.test.ts
//
// MAE / MFE — satu-satunya dua angka di jurnal ini yang bisa menjawab:
//
//   "Apakah stop saya terlalu ketat?"   (MAE pada trade MENANG)
//   "Apakah saya keluar terlalu cepat?" (MFE lawan R yang diraih)
//
// Trade yang menang +2R setelah sempat -0,9R melawan adalah cerita yang
// sama sekali berbeda dari yang menang +2R tanpa pernah tertekan. Win
// rate, expectancy, dan profit factor semuanya BUTA terhadap perbedaan
// itu.

import { describe, it, expect } from 'vitest'
import {
  jarakSlPct,
  maeR,
  mfeR,
  calcStatistikEkskursi,
  AMBANG_MAE_MENANG,
  AMBANG_EFISIENSI,
} from '@/lib/calculations/ekskursi'
import { tr, trBot } from './helper'

/** LONG entry 100, SL 95 -> jarak SL 5%. */
function long(p: Record<string, unknown> = {}) {
  return trBot({ position_type: 'long', entry_price: 100, stop_loss: 95, ...p })
}
/** SHORT entry 100, SL 105 -> jarak SL 5%. */
function short(p: Record<string, unknown> = {}) {
  return trBot({ position_type: 'short', entry_price: 100, stop_loss: 105, ...p })
}

describe('jarak SL', () => {
  it('diukur dari harga masuk, dalam persen, selalu positif', () => {
    expect(jarakSlPct(long())).toBe(5)
    expect(jarakSlPct(short())).toBe(5)
  })

  it('null kalau SL tidak dicatat — bukan nol', () => {
    expect(jarakSlPct(tr({ entry_price: 100 }))).toBeNull()
  })

  it('null kalau SL sama dengan harga masuk (tidak ada risiko terukur)', () => {
    expect(jarakSlPct(tr({ entry_price: 100, stop_loss: 100 }))).toBeNull()
  })
})

describe('MAE — sejauh mana harga melawan', () => {
  it('LONG memakai harga di BAWAH masuk', () => {
    // turun ke 97 = -3% = 0,6R dari jarak SL 5%
    expect(maeR(long({ mae_price: 97 }))).toBe(0.6)
  })

  it('SHORT memakai harga di ATAS masuk', () => {
    expect(maeR(short({ mae_price: 103 }))).toBe(0.6)
  })

  it('nol kalau harga tidak pernah bergerak melawan', () => {
    expect(maeR(long({ mae_price: 100 }))).toBe(0)
  })

  it('bisa melebihi 1R — harga sempat melewati SL sebelum tercatat', () => {
    expect(maeR(long({ mae_price: 93 }))).toBe(1.4)
  })

  it('null kalau tidak diketahui', () => {
    expect(maeR(long())).toBeNull()
    expect(maeR(long({ mae_price: null as unknown as number }))).toBeNull()
  })

  it('arah huruf besar tetap terbaca', () => {
    // Jalur yang ADA sekarang semuanya menormalkan: impor CSV memanggil
    // .toLowerCase(), dan kolomnya punya CHECK constraint di Postgres.
    // Tapi baris bisa juga masuk lewat SQL langsung atau bot lain.
    // Dikunci tes supaya toleransi ini jadi jaminan yang DISENGAJA,
    // bukan kebetulan yang bisa hilang saat ada yang merapikan kode.
    const t = long({ mae_price: 97 })
    ;(t as { position_type: string }).position_type = 'LONG'
    expect(maeR(t)).toBe(0.6)
    const u = short({ mae_price: 103 })
    ;(u as { position_type: string }).position_type = 'Short'
    expect(maeR(u)).toBe(0.6)
  })

  it('null kalau jarak SL tidak diketahui', () => {
    expect(maeR(tr({ position_type: 'long', entry_price: 100, mae_price: 97 }))).toBeNull()
  })

  it('null — BUKAN nol — kalau datanya tidak masuk akal', () => {
    // MAE sebuah LONG tidak mungkin di ATAS harga masuk. Memotongnya
    // jadi nol akan berbunyi "tidak pernah tertekan sedikit pun" —
    // kesimpulan paling berbahaya yang bisa diambil dari data rusak.
    expect(maeR(long({ mae_price: 104 }))).toBeNull()
    expect(maeR(short({ mae_price: 96 }))).toBeNull()
  })
})

describe('MFE — sejauh mana harga mendukung', () => {
  it('LONG memakai harga di ATAS masuk', () => {
    expect(mfeR(long({ mfe_price: 112.5 }))).toBe(2.5)
  })

  it('SHORT memakai harga di BAWAH masuk', () => {
    expect(mfeR(short({ mfe_price: 87.5 }))).toBe(2.5)
  })

  it('nol kalau harga tidak pernah mendukung', () => {
    expect(mfeR(short({ mfe_price: 100 }))).toBe(0)
  })

  it('null kalau datanya tidak masuk akal', () => {
    expect(mfeR(long({ mfe_price: 96 }))).toBeNull()
    expect(mfeR(short({ mfe_price: 104 }))).toBeNull()
  })
})

describe('statistik ekskursi', () => {
  it('kosong dan aman kalau belum ada data', () => {
    const s = calcStatistikEkskursi([tr({ result: 'win', net_pnl: 10 })])
    expect(s.trades_dengan_mae).toBe(0)
    expect(s.mae_rata_menang).toBeNull()
    expect(s.efisiensi).toBeNull()
    expect(s.stop_terlalu_ketat).toBeNull()
    expect(s.keluar_terlalu_cepat).toBeNull()
  })

  it('MAE rata-rata pada yang MENANG dipisah dari yang kalah', () => {
    const s = calcStatistikEkskursi([
      long({ result: 'win', r_multiple: 2, mae_price: 96 }),   // 0,8R
      long({ result: 'win', r_multiple: 1, mae_price: 98 }),   // 0,4R
      long({ result: 'loss', r_multiple: -1, mae_price: 95 }), // 1,0R — tidak ikut
    ])
    expect(s.mae_rata_menang).toBeCloseTo(0.6, 6)
    expect(s.trades_dengan_mae).toBe(3)
  })

  it('menandai stop terlalu ketat ketika MAE kemenangan melewati ambang', () => {
    // Ambang rujukan: kalau trade yang AKHIRNYA menang rutin tertekan
    // sampai 0,8R, stop yang lebih ketat sedikit saja akan membunuhnya.
    const ketat = Array.from({ length: 40 }, () =>
      long({ result: 'win', r_multiple: 2, mae_price: 95.5 }))   // 0,9R
    expect(calcStatistikEkskursi(ketat).stop_terlalu_ketat).toBe(true)

    const lega = Array.from({ length: 40 }, () =>
      long({ result: 'win', r_multiple: 2, mae_price: 99 }))     // 0,2R
    expect(calcStatistikEkskursi(lega).stop_terlalu_ketat).toBe(false)
  })

  it('efisiensi = R yang diraih dibagi R yang sempat tersedia', () => {
    const s = calcStatistikEkskursi([
      long({ result: 'win', r_multiple: 1, mfe_price: 110 }),  // raih 1R, tersedia 2R
      long({ result: 'win', r_multiple: 2, mfe_price: 120 }),  // raih 2R, tersedia 4R
    ])
    expect(s.mfe_rata).toBe(3)
    expect(s.efisiensi).toBeCloseTo(0.5, 6)  // rata 1,5R dari rata 3R
  })

  it('menandai keluar terlalu cepat di bawah ambang efisiensi', () => {
    const cepat = Array.from({ length: 40 }, () =>
      long({ result: 'win', r_multiple: 1, mfe_price: 120 }))   // 1R dari 4R = 25%
    expect(calcStatistikEkskursi(cepat).keluar_terlalu_cepat).toBe(true)

    const sabar = Array.from({ length: 40 }, () =>
      long({ result: 'win', r_multiple: 3.5, mfe_price: 120 })) // 3,5R dari 4R = 88%
    expect(calcStatistikEkskursi(sabar).keluar_terlalu_cepat).toBe(false)
  })

  it('vonis DITAHAN selama sampel belum cukup', () => {
    // Di bawah 30 trade, kedua vonis harus null — bukan false.
    // "Belum tahu" dan "sudah diperiksa, aman" adalah dua hal berbeda.
    const sedikit = Array.from({ length: 10 }, () =>
      long({ result: 'win', r_multiple: 1, mae_price: 95.5, mfe_price: 120 }))
    const s = calcStatistikEkskursi(sedikit)
    expect(s.cukup_sampel).toBe(false)
    expect(s.stop_terlalu_ketat).toBeNull()
    expect(s.keluar_terlalu_cepat).toBeNull()
    expect(s.mae_rata_menang).not.toBeNull() // angkanya tetap dilaporkan
  })

  it('MFE pada yang KALAH menunjukkan kekalahan yang sempat untung', () => {
    const s = calcStatistikEkskursi([
      long({ result: 'loss', r_multiple: -1, mfe_price: 107.5 }), // sempat +1,5R
      long({ result: 'loss', r_multiple: -1, mfe_price: 102.5 }), // sempat +0,5R
      long({ result: 'win', r_multiple: 2, mfe_price: 120 }),     // tidak ikut
    ])
    expect(s.mfe_rata_kalah).toBeCloseTo(1.0, 6)
  })

  it('persentil 90 MAE kemenangan memberi batas stop yang terukur', () => {
    // 10 kemenangan dengan MAE 0,1R .. 1,0R.
    //
    // Konvensi: INTERPOLASI LINIER, sama dengan bawaan numpy/pandas.
    // pos = (10-1) x 0,9 = 8,1 -> 0,9 + 0,1 x (1,0 - 0,9) = 0,91.
    // Harapan awal saya 0,9 salah: itu bukan konvensi mana pun —
    // nearest-rank justru memberi 1,0. Dicocokkan dengan numpy.
    const t = Array.from({ length: 10 }, (_, i) =>
      long({ result: 'win', r_multiple: 2, mae_price: 100 - (i + 1) * 0.5 }))
    expect(calcStatistikEkskursi(t).mae_p90_menang).toBeCloseTo(0.91, 6)
  })

  it('persentil 90 pada satu nilai adalah nilai itu sendiri', () => {
    const t = [long({ result: 'win', r_multiple: 2, mae_price: 97 })]
    expect(calcStatistikEkskursi(t).mae_p90_menang).toBeCloseTo(0.6, 6)
  })

  it('ambangnya diekspor supaya tampilan tidak menuliskan angkanya sendiri', () => {
    expect(AMBANG_MAE_MENANG).toBe(0.8)
    expect(AMBANG_EFISIENSI).toBe(0.5)
  })
})
