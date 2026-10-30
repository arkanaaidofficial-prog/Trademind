// tests/analytics.test.ts
//
// Pengelompokan waktu di halaman Analytics. Dua cacat yang diukur pada
// kode lama sebelum berkas ini ditulis (zona peramban Asia/Jakarta):
//
//   Per Hari : entry_at.slice(0,10)        -> tanggal UTC
//   Per Jam  : new Date(entry_at).getHours() -> jam WIB
//
//   Dua trade pada 2026-10-30T20:00Z dan 22:30Z dilaporkan di tanggal
//   "2026-10-30" tapi pada jam "03:00" dan "05:00" — yang di WIB sudah
//   tanggal 31. Satu halaman, dua kalender.
//
//   Win rate dengan 2 posisi masih terbuka: dilaporkan 40%, benarnya 67%.

import { describe, it, expect } from 'vitest'
import {
  bagianWaktuLokal,
  kelompokPerHari,
  kelompokPerJam,
  kurvaEkuitasR,
  zonaWaktuBawaan,
} from '@/lib/calculations/analytics'
import { tr, trBot } from './helper'

describe('bagian waktu lokal', () => {
  it('memakai zona yang diminta, bukan zona mesin', () => {
    expect(bagianWaktuLokal('2026-10-30T20:00:00Z', 'Asia/Jakarta')).toEqual({
      tanggal: '2026-10-31',
      jam: 3,
    })
    expect(bagianWaktuLokal('2026-10-30T20:00:00Z', 'UTC')).toEqual({
      tanggal: '2026-10-30',
      jam: 20,
    })
  })

  it('tengah malam terbaca jam 0, bukan jam 24', () => {
    expect(bagianWaktuLokal('2026-10-30T17:00:00Z', 'Asia/Jakarta')).toEqual({
      tanggal: '2026-10-31',
      jam: 0,
    })
  })

  it('zona yang tidak dikenal jatuh ke UTC, bukan melempar galat', () => {
    expect(bagianWaktuLokal('2026-10-30T20:00:00Z', 'Mars/Olympus')).toEqual({
      tanggal: '2026-10-30',
      jam: 20,
    })
  })
})

describe('zona waktu bawaan', () => {
  it('memakai zona dari profil kalau ada', () => {
    expect(zonaWaktuBawaan('Asia/Makassar')).toBe('Asia/Makassar')
  })

  it('jatuh ke zona mesin kalau profil kosong', () => {
    expect(zonaWaktuBawaan(null)).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(zonaWaktuBawaan(undefined)).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(zonaWaktuBawaan('   ')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})

describe('kelompok per hari', () => {
  it('memakai tanggal REALISASI di zona yang diminta', () => {
    // Posisi dibuka 20 Okt, ditutup 30 Okt 20:00 UTC = 31 Okt 03:00 WIB.
    // P/L masuk saldo saat keluar, jadi hari itulah yang dicatat.
    const hasil = kelompokPerHari(
      [tr({ entry_at: '2026-10-20T01:00:00Z', exit_at: '2026-10-30T20:00:00Z', result: 'win', net_pnl: 10 })],
      'Asia/Jakarta',
    )
    expect(hasil).toHaveLength(1)
    expect(hasil[0].date).toBe('2026-10-31')
    expect(hasil[0].pnl).toBe(10)
  })

  it('posisi yang masih terbuka tidak membuat hari palsu ber-P/L nol', () => {
    const hasil = kelompokPerHari(
      [
        tr({ exit_at: '2026-10-30T02:00:00Z', result: 'win', net_pnl: 10 }),
        tr({ entry_at: '2026-10-29T02:00:00Z' }), // belum ditutup
      ],
      'Asia/Jakarta',
    )
    expect(hasil).toHaveLength(1)
    expect(hasil[0].trades).toBe(1)
  })

  it('trade selesai yang nominalnya kosong tidak merusak jumlah harian', () => {
    // net_pnl undefined + penjumlahan tanpa penyaring menghasilkan NaN,
    // dan NaN menular ke seluruh batang grafik hari itu.
    const hasil = kelompokPerHari(
      [
        tr({ exit_at: '2026-10-30T02:00:00Z', result: 'win', net_pnl: 10 }),
        tr({ exit_at: '2026-10-30T03:00:00Z', result: 'win', net_pnl: undefined }),
      ],
      'Asia/Jakarta',
    )
    expect(hasil[0].pnl).toBe(10)
    expect(hasil[0].trades).toBe(2)
  })

  it('R harian dijumlah, dan null kalau hari itu tak punya trade ber-R', () => {
    const hasil = kelompokPerHari(
      [
        trBot({ exit_at: '2026-10-30T02:00:00Z', result: 'win', r_multiple: 2 }),
        trBot({ exit_at: '2026-10-30T03:00:00Z', result: 'loss', r_multiple: -0.5 }),
        tr({ exit_at: '2026-10-31T03:00:00Z', result: 'win', net_pnl: 10 }),
      ],
      'UTC',
    )
    expect(hasil[0].r).toBe(1.5)
    expect(hasil[1].r).toBeNull()
  })

  it('diurutkan menaik berdasarkan tanggal', () => {
    const hasil = kelompokPerHari(
      [
        tr({ exit_at: '2026-10-31T02:00:00Z', result: 'win', net_pnl: 1 }),
        tr({ exit_at: '2026-10-29T02:00:00Z', result: 'win', net_pnl: 2 }),
        tr({ exit_at: '2026-10-30T02:00:00Z', result: 'win', net_pnl: 3 }),
      ],
      'Asia/Jakarta',
    )
    expect(hasil.map(h => h.date)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31'])
  })
})

describe('kelompok per jam', () => {
  it('memakai jam ENTRY — pertanyaannya "jam berapa entry saya paling bagus"', () => {
    const hasil = kelompokPerJam(
      [tr({ entry_at: '2026-10-30T20:00:00Z', exit_at: '2026-11-05T01:00:00Z', result: 'win', net_pnl: 10 })],
      'Asia/Jakarta',
    )
    expect(hasil[0].hour).toBe('03:00')
  })

  it('sepakat dengan kelompok per hari soal tanggal trade yang sama', () => {
    // Inti perbaikannya: satu halaman, SATU kalender.
    const t = tr({ entry_at: '2026-10-30T20:00:00Z', exit_at: '2026-10-30T20:00:00Z', result: 'win', net_pnl: 10 })
    const hari = kelompokPerHari([t], 'Asia/Jakarta')[0]
    const jam = kelompokPerJam([t], 'Asia/Jakarta')[0]
    expect(hari.date).toBe('2026-10-31')
    expect(jam.hour).toBe('03:00')
    expect(bagianWaktuLokal(t.entry_at, 'Asia/Jakarta').tanggal).toBe(hari.date)
  })

  it('win rate tidak dibagi dengan posisi yang masih terbuka', () => {
    // Kode lama melaporkan 40% untuk susunan ini. Benarnya 67%.
    const hasil = kelompokPerJam(
      [
        tr({ entry_at: '2026-10-30T01:00:00Z', result: 'win', net_pnl: 100 }),
        tr({ entry_at: '2026-10-30T01:10:00Z', result: 'win', net_pnl: 100 }),
        tr({ entry_at: '2026-10-30T01:20:00Z', result: 'loss', net_pnl: -50 }),
        tr({ entry_at: '2026-10-30T01:30:00Z' }),
        tr({ entry_at: '2026-10-30T01:40:00Z' }),
      ],
      'UTC',
    )
    expect(hasil[0].trades).toBe(5)
    expect(hasil[0].selesai).toBe(3)
    expect(hasil[0].win_rate).toBe(67)
  })

  it('win_rate nol saat satu jam belum punya trade selesai', () => {
    const hasil = kelompokPerJam([tr({ entry_at: '2026-10-30T01:00:00Z' })], 'UTC')
    expect(hasil[0].win_rate).toBe(0)
    expect(hasil[0].selesai).toBe(0)
  })

  it('avg_r per jam terbaca dari trade bot yang tidak punya nominal', () => {
    const hasil = kelompokPerJam(
      [
        trBot({ entry_at: '2026-10-30T01:00:00Z', result: 'win', r_multiple: 2 }),
        trBot({ entry_at: '2026-10-30T01:30:00Z', result: 'loss', r_multiple: -1 }),
      ],
      'UTC',
    )
    expect(hasil[0].avg_r).toBe(0.5)
    expect(hasil[0].net_pnl).toBe(0)
    expect(Number.isNaN(hasil[0].net_pnl)).toBe(false)
  })

  it('avg_r dibagi jumlah trade ber-R, bukan jumlah trade di jam itu', () => {
    const hasil = kelompokPerJam(
      [
        trBot({ entry_at: '2026-10-30T01:00:00Z', result: 'win', r_multiple: 3 }),
        tr({ entry_at: '2026-10-30T01:30:00Z', result: 'win', net_pnl: 10 }), // tanpa risiko -> tanpa R
      ],
      'UTC',
    )
    expect(hasil[0].trades).toBe(2)
    expect(hasil[0].avg_r).toBe(3)
  })

  it('avg_r null kalau jam itu belum punya satu pun trade ber-R', () => {
    const hasil = kelompokPerJam(
      [tr({ entry_at: '2026-10-30T01:00:00Z', result: 'win', net_pnl: 10 })],
      'UTC',
    )
    expect(hasil[0].avg_r).toBeNull()
  })

  it('diurutkan menaik berdasarkan jam', () => {
    const hasil = kelompokPerJam(
      [
        tr({ entry_at: '2026-10-30T22:00:00Z', result: 'win', net_pnl: 1 }),
        tr({ entry_at: '2026-10-30T03:00:00Z', result: 'win', net_pnl: 1 }),
      ],
      'UTC',
    )
    expect(hasil.map(h => h.hour)).toEqual(['03:00', '22:00'])
  })
})

describe('kurva ekuitas R', () => {
  it('menumpuk R pada urutan keluar', () => {
    // Susunan ini dicari dengan pencarian, bukan ditebak. Dua elemen
    // TIDAK cukup, dan tiga elemen pun bisa lolos kalau tanggalnya
    // kurang beruntung: V8 memanggil komparator dengan operan yang
    // membuat komparator rusak-sebelah kebetulan memberi urutan benar.
    //
    //   kurva BENAR             : [-1, 4, 2]
    //   kalau wa saja pakai entry: [-1, -3, 2]
    //   kalau keduanya pakai entry: [5, 4, 2]
    const hasil = kurvaEkuitasR(
      [
        trBot({ r_multiple: 5, entry_at: '2026-10-01T00:00:00Z', exit_at: '2026-10-28T00:00:00Z' }),
        trBot({ r_multiple: -1, entry_at: '2026-10-20T00:00:00Z', exit_at: '2026-10-21T00:00:00Z' }),
        trBot({ r_multiple: -2, entry_at: '2026-10-25T00:00:00Z', exit_at: '2026-10-29T00:00:00Z' }),
      ],
      'UTC',
    )
    expect(hasil.map(h => h.r)).toEqual([-1, 4, 2])
    expect(hasil.map(h => h.date)).toEqual(['2026-10-21', '2026-10-28', '2026-10-29'])
  })

  it('melewati trade yang tidak punya R', () => {
    const hasil = kurvaEkuitasR(
      [
        trBot({ r_multiple: 2, exit_at: '2026-10-03T00:00:00Z' }),
        tr({ result: 'win', net_pnl: 100, exit_at: '2026-10-04T00:00:00Z' }), // tanpa risk_amount
      ],
      'UTC',
    )
    expect(hasil).toHaveLength(1)
  })
})
