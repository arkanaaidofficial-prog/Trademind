// tests/aturan.test.ts
//
// Pemeriksaan aturan dagang. Sebelum berkas ini ada, logikanya disalin
// di TIGA tempat (stats.ts checkRuleViolations, hooks/useRuleViolations,
// dashboard/page.tsx checkViolations) dengan isi yang berbeda-beda.
//
// Dua cacat yang diukur pada kode lama:
//
// 1. Jendela lintas tengah malam mustahil. Aturan 22:00-02:00 diperiksa
//    dengan (t < mulai || t > selesai), yang untuk mulai > selesai
//    bernilai benar untuk SETIAP jam. Terukur: entry 23:00 WIB, 01:00
//    WIB, dan 12:00 WIB — ketiganya dilaporkan DILANGGAR. Aturan itu
//    bukan cuma salah, dia menandai segalanya.
//
// 2. Perlakuan huruf besar/kecil berbeda antar salinan. Simbol
//    "btcusdt" dengan daftar izin ["BTCUSDT"]: stats.ts bilang
//    DILANGGAR, useRuleViolations bilang boleh.

import { describe, it, expect } from 'vitest'
import { dalamJamDagang, periksaPelanggaran, ringkasHarian } from '@/lib/rules'
import { tr, trBot } from './helper'

describe('jendela jam dagang', () => {
  it('jendela biasa dalam satu hari', () => {
    expect(dalamJamDagang('12:00', '08:00', '17:00')).toBe(true)
    expect(dalamJamDagang('07:59', '08:00', '17:00')).toBe(false)
    expect(dalamJamDagang('17:01', '08:00', '17:00')).toBe(false)
  })

  it('menit di dalam jam benar-benar dihitung', () => {
    // Tanpa ini, mengganti (jam*60 + menit) jadi (jam + menit) tidak
    // ketahuan: pada jendela berjam bulat kedua rumus kebetulan
    // memberi jawaban yang sama.
    expect(dalamJamDagang('08:30', '08:00', '09:00')).toBe(true)
    expect(dalamJamDagang('09:30', '08:00', '09:00')).toBe(false)
    expect(dalamJamDagang('08:00', '08:30', '09:00')).toBe(false)
  })

  it('kedua ujung jendela ikut diizinkan', () => {
    expect(dalamJamDagang('08:00', '08:00', '17:00')).toBe(true)
    expect(dalamJamDagang('17:00', '08:00', '17:00')).toBe(true)
  })

  it('jendela yang melintasi tengah malam', () => {
    // Sesi malam Asia: 22:00 sampai 02:00 keesokan hari.
    expect(dalamJamDagang('23:00', '22:00', '02:00')).toBe(true)
    expect(dalamJamDagang('01:00', '22:00', '02:00')).toBe(true)
    expect(dalamJamDagang('22:00', '22:00', '02:00')).toBe(true)
    expect(dalamJamDagang('02:00', '22:00', '02:00')).toBe(true)
    expect(dalamJamDagang('12:00', '22:00', '02:00')).toBe(false)
    expect(dalamJamDagang('03:00', '22:00', '02:00')).toBe(false)
  })

  it('jendela yang mulai dan selesai sama berarti satu menit itu saja', () => {
    expect(dalamJamDagang('09:00', '09:00', '09:00')).toBe(true)
    expect(dalamJamDagang('09:01', '09:00', '09:00')).toBe(false)
  })
})

describe('pelanggaran aturan', () => {
  const aturan = {
    max_risk_per_trade_pct: 2,
    max_trades_per_day: 3,
    max_daily_loss: 100,
    allowed_pairs: ['BTCUSDT', 'ETHUSDT'],
    allowed_hours_start: '22:00',
    allowed_hours_end: '02:00',
  }

  function kode(trade: Parameters<typeof periksaPelanggaran>[0], konteks = {}) {
    return periksaPelanggaran(trade, aturan, 'Asia/Jakarta', konteks).map(p => p.aturan)
  }

  it('entry di dalam jendela lintas tengah malam BUKAN pelanggaran', () => {
    // 2026-10-30T16:00Z = 23:00 WIB
    expect(kode(tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T16:00:00Z' }))).not.toContain('di_luar_jam')
  })

  it('entry di luar jendela tetap tertangkap', () => {
    // 2026-10-30T05:00Z = 12:00 WIB
    expect(kode(tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T05:00:00Z' }))).toContain('di_luar_jam')
  })

  it('menit dibaca di zona itu juga, bukan menit UTC', () => {
    // Jendela 22:00-02:00, entry 2026-10-30T16:20Z.
    // Di Asia/Kolkata (+5:30) itu 21:50 -> DI LUAR jendela.
    // Kode yang mengambil jam dari zona tapi menit dari UTC akan
    // membaca "21:20", yang kebetulan juga di luar — maka dipakai
    // jendela lain yang membuat selisihnya menentukan.
    const t = tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T16:20:00Z' })
    const aturanSempit = { allowed_hours_start: '21:30', allowed_hours_end: '21:59' }
    // 21:50 ada di dalam jendela; 21:20 (menit UTC) tidak.
    expect(periksaPelanggaran(t, aturanSempit, 'Asia/Kolkata', {}).map(p => p.aturan))
      .not.toContain('di_luar_jam')
  })

  it('jam dibaca di zona yang diminta, bukan zona mesin', () => {
    const t = tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T16:00:00Z' }) // 23:00 WIB, 16:00 UTC
    expect(periksaPelanggaran(t, aturan, 'Asia/Jakarta', {}).map(p => p.aturan)).not.toContain('di_luar_jam')
    expect(periksaPelanggaran(t, aturan, 'UTC', {}).map(p => p.aturan)).toContain('di_luar_jam')
  })

  it('pair dibandingkan tanpa peduli huruf besar/kecil', () => {
    expect(kode(tr({ symbol: 'btcusdt', entry_at: '2026-10-30T16:00:00Z' }))).not.toContain('pair_tak_diizinkan')
    expect(kode(tr({ symbol: 'DOGEUSDT', entry_at: '2026-10-30T16:00:00Z' }))).toContain('pair_tak_diizinkan')
  })

  it('daftar izin yang ditulis huruf kecil juga cocok', () => {
    // Kedua SISI harus dinormalkan. Kalau hanya simbolnya yang
    // dihurufbesarkan, aturan yang Bapak ketik "btcusdt" di halaman
    // Rules akan menandai setiap trade BTCUSDT sebagai pelanggaran.
    const hasil = periksaPelanggaran(
      tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T16:00:00Z' }),
      { allowed_pairs: ['btcusdt', ' ethusdt '] },
      'Asia/Jakarta',
      {},
    )
    expect(hasil.map(p => p.aturan)).not.toContain('pair_tak_diizinkan')
  })

  it('risiko melebihi batas tertangkap, yang tepat di batas tidak', () => {
    expect(kode(tr({ symbol: 'BTCUSDT', risk_percent: 2.5, entry_at: '2026-10-30T16:00:00Z' })))
      .toContain('risiko_berlebih')
    expect(kode(tr({ symbol: 'BTCUSDT', risk_percent: 2, entry_at: '2026-10-30T16:00:00Z' })))
      .not.toContain('risiko_berlebih')
  })

  it('batas rugi harian BENAR-BENAR diperiksa', () => {
    // Di stats.ts lama, max_daily_loss diterima sebagai parameter lalu
    // tidak pernah dipakai sama sekali. Aturan yang disetel Bapak diam.
    const t = tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T16:00:00Z' })
    expect(kode(t, { pnl_hari_ini: -150 })).toContain('batas_rugi_harian')
    expect(kode(t, { pnl_hari_ini: -50 })).not.toContain('batas_rugi_harian')
    // Tepat DI batas sudah dihitung mencapai batas.
    expect(kode(t, { pnl_hari_ini: -100 })).toContain('batas_rugi_harian')
    // Untung besar bukan pelanggaran batas RUGI.
    expect(kode(t, { pnl_hari_ini: 500 })).not.toContain('batas_rugi_harian')
  })

  it('batas jumlah trade harian diperiksa', () => {
    const t = tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T16:00:00Z' })
    expect(kode(t, { trade_hari_ini: 3 })).toContain('maks_trade_harian')
    expect(kode(t, { trade_hari_ini: 2 })).not.toContain('maks_trade_harian')
  })

  it('aturan yang tidak diisi tidak menghasilkan pelanggaran', () => {
    const hasil = periksaPelanggaran(
      tr({ symbol: 'DOGEUSDT', risk_percent: 99, entry_at: '2026-10-30T05:00:00Z' }),
      {},
      'Asia/Jakarta',
      { pnl_hari_ini: -9999, trade_hari_ini: 99 },
    )
    expect(hasil).toEqual([])
  })

  it('aturan jam diabaikan kalau hanya salah satu ujung diisi', () => {
    const hasil = periksaPelanggaran(
      tr({ symbol: 'BTCUSDT', entry_at: '2026-10-30T05:00:00Z' }),
      { allowed_hours_start: '22:00' },
      'Asia/Jakarta',
      {},
    )
    expect(hasil).toEqual([])
  })

  it('trade bot tidak dinilai dengan aturan disiplin manusia', () => {
    // Aturan "maks 3 trade per hari" dan "jam dagang" adalah pagar
    // disiplin untuk Bapak. Bot memang memindai tiap 15 menit sepanjang
    // hari; menandai tiap kirimannya sebagai pelanggaran hanya
    // menenggelamkan peringatan yang sungguhan.
    const hasil = periksaPelanggaran(
      trBot({ symbol: 'DOGEUSDT', entry_at: '2026-10-30T05:00:00Z' }),
      aturan,
      'Asia/Jakarta',
      { trade_hari_ini: 50 },
    )
    expect(hasil.map(p => p.aturan)).not.toContain('di_luar_jam')
    expect(hasil.map(p => p.aturan)).not.toContain('maks_trade_harian')
  })

  it('risiko berlebih TETAP dinilai untuk trade bot', () => {
    // Yang satu ini bukan soal disiplin manusia — itu soal ukuran posisi,
    // dan bot bisa salah ukur persis seperti manusia.
    const hasil = periksaPelanggaran(
      trBot({ symbol: 'BTCUSDT', risk_percent: 5, entry_at: '2026-10-30T16:00:00Z' }),
      aturan,
      'Asia/Jakarta',
      {},
    )
    expect(hasil.map(p => p.aturan)).toContain('risiko_berlebih')
  })

  it('tingkat keparahan dibedakan', () => {
    const hasil = periksaPelanggaran(
      tr({ symbol: 'DOGEUSDT', risk_percent: 9, entry_at: '2026-10-30T16:00:00Z' }),
      aturan, 'Asia/Jakarta', {},
    )
    const peta = Object.fromEntries(hasil.map(p => [p.aturan, p.tingkat]))
    expect(peta['risiko_berlebih']).toBe('error')
    expect(peta['pair_tak_diizinkan']).toBe('warning')
  })
})

describe('ringkasan harian', () => {
  it('"hari ini" dihitung di zona Bapak, bukan di UTC', () => {
    // 2026-10-30T20:00Z sudah tanggal 31 di WIB. Memakai tanggal UTC
    // membuat trade dini hari WIB jatuh ke hari kemarin.
    const k = ringkasHarian(
      [tr({ entry_at: '2026-10-30T20:00:00Z', exit_at: '2026-10-30T21:00:00Z', result: 'win', net_pnl: 25 })],
      'Asia/Jakarta',
      '2026-10-31',
    )
    expect(k.trade_hari_ini).toBe(1)
    expect(k.pnl_hari_ini).toBe(25)
  })

  it('jumlah trade harian TIDAK menghitung kiriman bot', () => {
    // "Maks 3 trade per hari" adalah pagar disiplin untuk Bapak. Bot
    // memindai tiap 15 menit; kalau kirimannya ikut dihitung, pagar itu
    // jebol tiap pagi dan peringatannya jadi derau.
    const k = ringkasHarian(
      [
        tr({ entry_at: '2026-10-31T02:00:00Z' }),
        trBot({ entry_at: '2026-10-31T02:05:00Z' }),
        trBot({ entry_at: '2026-10-31T02:10:00Z' }),
      ],
      'Asia/Jakarta',
      '2026-10-31',
    )
    expect(k.trade_hari_ini).toBe(1)
  })

  it('P/L harian memakai tanggal REALISASI, dan kerugian bot tetap dihitung', () => {
    const k = ringkasHarian(
      [
        // dibuka kemarin, ditutup hari ini -> masuk hari ini
        tr({ entry_at: '2026-10-29T02:00:00Z', exit_at: '2026-10-31T02:00:00Z', result: 'loss', net_pnl: -40 }),
        // dibuka hari ini, belum ditutup -> belum merealisasikan apa pun
        tr({ entry_at: '2026-10-31T03:00:00Z' }),
        // bot: punya hasil tapi tidak punya nominal -> tidak menggeser angka
        trBot({ entry_at: '2026-10-31T03:00:00Z', exit_at: '2026-10-31T04:00:00Z', result: 'loss', r_multiple: -1 }),
      ],
      'Asia/Jakarta',
      '2026-10-31',
    )
    expect(k.pnl_hari_ini).toBe(-40)
  })

  it('hari tanpa trade memberi nol, bukan undefined', () => {
    const k = ringkasHarian([], 'Asia/Jakarta', '2026-10-31')
    expect(k.trade_hari_ini).toBe(0)
    expect(k.pnl_hari_ini).toBe(0)
  })
})
