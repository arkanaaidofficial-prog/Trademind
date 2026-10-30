// src/lib/rules.ts
// Satu-satunya tempat aturan dagang diperiksa.
//
// Sebelumnya logika ini disalin di TIGA tempat dengan isi yang berbeda:
//   - src/lib/calculations/stats.ts  checkRuleViolations()
//   - src/hooks/useRuleViolations.ts
//   - src/app/(dashboard)/dashboard/page.tsx  checkViolations()
//
// Perbedaannya bukan gaya penulisan, tapi JAWABAN. Simbol "btcusdt"
// dengan daftar izin ["BTCUSDT"]: salinan di stats.ts bilang dilanggar,
// salinan di hook bilang boleh. Dan stats.ts menerima max_daily_loss
// sebagai parameter lalu tidak pernah memakainya — aturan yang disetel
// pemilik jurnal diam begitu saja.

import type { Trade } from '@/types/trade';
import { bagianWaktuLokal } from './calculations/analytics';

export type AturanDagang = {
  max_risk_per_trade_pct?: number | null;
  max_trades_per_day?: number | null;
  max_daily_loss?: number | null;
  allowed_pairs?: string[] | null;
  allowed_hours_start?: string | null;
  allowed_hours_end?: string | null;
};

export type KonteksHarian = {
  trade_hari_ini?: number;
  pnl_hari_ini?: number;
};

export type Pelanggaran = {
  aturan: string;
  pesan: string;
  tingkat: 'error' | 'warning';
};

/** "HH:MM" jadi menit sejak tengah malam. */
function keMenit(jam: string): number {
  const [h, m] = jam.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Apakah sebuah jam berada di dalam jendela dagang.
 *
 * Menangani jendela yang MELINTASI TENGAH MALAM. Pemeriksaan lama
 * (t < mulai || t > selesai) bernilai benar untuk SETIAP jam begitu
 * mulai > selesai, jadi aturan "22:00-02:00" menandai seluruh hari
 * sebagai pelanggaran — termasuk jam 23:00 dan 01:00 yang justru ingin
 * diizinkan. Kedua ujung jendela ikut diizinkan.
 */
export function dalamJamDagang(jam: string, mulai: string, selesai: string): boolean {
  const t = keMenit(jam);
  const a = keMenit(mulai);
  const b = keMenit(selesai);
  if (a <= b) return t >= a && t <= b;
  // Melintasi tengah malam: dua potong, [mulai..24:00) dan [00:00..selesai]
  return t >= a || t <= b;
}

/** Aturan yang mengukur DISIPLIN MANUSIA, bukan kualitas posisi.
 *  Bot memang memindai tiap 15 menit sepanjang hari — menandai setiap
 *  kirimannya hanya menenggelamkan peringatan yang sungguhan. */
const ATURAN_DISIPLIN_MANUSIA = new Set(['di_luar_jam', 'maks_trade_harian']);

function dariBot(trade: Pick<Trade, 'mode'>): boolean {
  return trade.mode === 'bot';
}

export function periksaPelanggaran(
  trade: Partial<Trade>,
  aturan: AturanDagang,
  zona: string,
  konteks: KonteksHarian = {},
): Pelanggaran[] {
  const hasil: Pelanggaran[] = [];

  const risiko = trade.risk_percent;
  if (
    aturan.max_risk_per_trade_pct != null &&
    risiko != null && Number.isFinite(Number(risiko)) &&
    Number(risiko) > aturan.max_risk_per_trade_pct
  ) {
    hasil.push({
      aturan: 'risiko_berlebih',
      tingkat: 'error',
      pesan: `Risiko ${risiko}% melebihi batas ${aturan.max_risk_per_trade_pct}% per trade`,
    });
  }

  if (aturan.allowed_pairs && aturan.allowed_pairs.length > 0 && trade.symbol) {
    const simbol = trade.symbol.trim().toUpperCase();
    const diizinkan = aturan.allowed_pairs.map(p => p.trim().toUpperCase());
    if (!diizinkan.includes(simbol)) {
      hasil.push({
        aturan: 'pair_tak_diizinkan',
        tingkat: 'warning',
        pesan: `${simbol} bukan pair yang diizinkan di aturan Bapak`,
      });
    }
  }

  // Jendela jam hanya berlaku kalau KEDUA ujung diisi.
  if (aturan.allowed_hours_start && aturan.allowed_hours_end && trade.entry_at) {
    const { jam, menit } = bagianWaktuLokal(trade.entry_at, zona);
    const jamMenit = `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;
    if (!dalamJamDagang(jamMenit, aturan.allowed_hours_start, aturan.allowed_hours_end)) {
      hasil.push({
        aturan: 'di_luar_jam',
        tingkat: 'warning',
        pesan: `Entry jam ${jamMenit} di luar jam dagang ${aturan.allowed_hours_start}-${aturan.allowed_hours_end}`,
      });
    }
  }

  if (
    aturan.max_trades_per_day != null &&
    konteks.trade_hari_ini != null &&
    konteks.trade_hari_ini >= aturan.max_trades_per_day
  ) {
    hasil.push({
      aturan: 'maks_trade_harian',
      tingkat: 'error',
      pesan: `Sudah ${konteks.trade_hari_ini} trade hari ini, batas ${aturan.max_trades_per_day}`,
    });
  }

  // Batas RUGI harian. Di stats.ts lama parameter ini diterima lalu
  // tidak pernah dibaca sekali pun.
  if (
    aturan.max_daily_loss != null &&
    konteks.pnl_hari_ini != null &&
    konteks.pnl_hari_ini < 0 &&
    Math.abs(konteks.pnl_hari_ini) >= aturan.max_daily_loss
  ) {
    hasil.push({
      aturan: 'batas_rugi_harian',
      tingkat: 'error',
      pesan: `Rugi hari ini $${Math.abs(konteks.pnl_hari_ini).toFixed(2)} mencapai batas $${aturan.max_daily_loss}`,
    });
  }

  if (dariBot(trade as Trade)) {
    return hasil.filter(p => !ATURAN_DISIPLIN_MANUSIA.has(p.aturan));
  }
  return hasil;
}

/**
 * Ringkasan hari berjalan untuk dipakai periksaPelanggaran().
 *
 * Dua keputusan yang disengaja:
 *
 *  - "hari ini" ditentukan di ZONA pemilik jurnal, bukan di UTC. Versi
 *    lama memakai new Date().toISOString().slice(0,10), jadi trade dini
 *    hari WIB jatuh ke hari kemarin.
 *
 *  - jumlah trade harian TIDAK menghitung kiriman bot. "Maks 3 trade per
 *    hari" adalah pagar disiplin untuk manusia; bot memindai tiap 15
 *    menit dan akan menjebolnya tiap pagi, membuat peringatannya jadi
 *    derau. P/L harian tetap menghitung semua, karena kerugian bot tetap
 *    kerugian - hanya saja bot memang tidak mengirim nominal.
 */
export function ringkasHarian(
  trades: Trade[],
  zona: string,
  hariIni: string,
): Required<KonteksHarian> {
  let jumlah = 0;
  let pnl = 0;

  for (const t of trades) {
    if (!dariBot(t) && bagianWaktuLokal(t.entry_at, zona).tanggal === hariIni) {
      jumlah += 1;
    }
    const selesai = t.result !== undefined && t.result !== null;
    const nilai = t.net_pnl;
    if (
      selesai &&
      nilai !== undefined && nilai !== null && Number.isFinite(nilai) &&
      bagianWaktuLokal(t.exit_at ?? t.entry_at, zona).tanggal === hariIni
    ) {
      pnl += nilai;
    }
  }

  return { trade_hari_ini: jumlah, pnl_hari_ini: parseFloat(pnl.toFixed(2)) };
}

/** Tanggal "hari ini" dalam format YYYY-MM-DD di zona yang diminta. */
export function tanggalHariIni(zona: string, sekarang: Date = new Date()): string {
  return bagianWaktuLokal(sekarang.toISOString(), zona).tanggal;
}
