// src/lib/calculations/analytics.ts
// Pengelompokan waktu untuk halaman Analytics.
//
// Berkas ini lahir dari satu cacat yang diukur pada kode lama:
//
//   Per Hari : t.entry_at.slice(0, 10)          -> tanggal UTC
//   Per Jam  : new Date(t.entry_at).getHours()  -> jam zona peramban
//
// Di WIB keduanya berbeda tujuh jam, jadi satu halaman memakai dua
// kalender sekaligus. Trade pada 2026-10-30T20:00Z muncul di baris
// tanggal "30 Okt" sekaligus di baris jam "03:00" — jam 03:00 yang
// sebenarnya sudah tanggal 31.
//
// Sekarang SEMUA pengelompokan waktu lewat satu pintu: bagianWaktuLokal().

import type { Trade } from '@/types/trade';
import { nilaiR } from './stats';

export type EmberHari = {
  date: string;
  pnl: number;
  trades: number;
  r: number | null;
};

export type EmberJam = {
  hour: string;
  trades: number;
  /** Trade yang sudah punya hasil. Inilah pembagi win_rate. */
  selesai: number;
  win_rate: number;
  net_pnl: number;
  avg_r: number | null;
};

const zonaSah = new Map<string, boolean>();

function zonaBisaDipakai(zona: string): boolean {
  const tersimpan = zonaSah.get(zona);
  if (tersimpan !== undefined) return tersimpan;
  let sah = true;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zona });
  } catch {
    sah = false;
  }
  zonaSah.set(zona, sah);
  return sah;
}

/**
 * Pecah sebuah waktu ISO menjadi tanggal dan jam DI ZONA YANG DIMINTA.
 *
 * Sengaja tidak memakai getHours() maupun slice(0,10): yang pertama
 * terikat zona mesin, yang kedua terkunci di UTC. Keduanya tidak bisa
 * diperintah memakai zona profil pengguna.
 */
export function bagianWaktuLokal(iso: string, zona: string): { tanggal: string; jam: number } {
  const waktu = new Date(iso);
  const dipakai = zonaBisaDipakai(zona) ? zona : 'UTC';
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: dipakai,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(waktu);

  const ambil = (jenis: string) => bagian.find(b => b.type === jenis)?.value ?? '';
  // Beberapa mesin memberi "24" untuk tengah malam.
  const jam = Number(ambil('hour')) % 24;
  return { tanggal: `${ambil('year')}-${ambil('month')}-${ambil('day')}`, jam };
}

/** Zona dari profil pengguna, atau zona mesin kalau profilnya kosong. */
export function zonaWaktuBawaan(zonaProfil?: string | null): string {
  const bersih = (zonaProfil ?? '').trim();
  if (bersih) return bersih;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function punyaPnl(t: Trade): boolean {
  return t.net_pnl !== undefined && t.net_pnl !== null && Number.isFinite(t.net_pnl);
}

function sudahSelesai(t: Trade): boolean {
  return t.result !== undefined && t.result !== null;
}

/**
 * P/L per hari, dikelompokkan pada tanggal REALISASI.
 *
 * Posisi yang dibuka 20 Okt dan ditutup 30 Okt menambah saldo pada
 * 30 Okt, bukan 20 Okt. Posisi bot pernah terukur menggantung sampai
 * 613 jam, jadi selisihnya bukan perkara satu-dua jam.
 */
export function kelompokPerHari(trades: Trade[], zona: string): EmberHari[] {
  const peta = new Map<string, { pnl: number; trades: number; totalR: number; denganR: number }>();

  for (const t of trades) {
    if (!sudahSelesai(t)) continue; // posisi terbuka belum merealisasikan apa pun
    const { tanggal } = bagianWaktuLokal(t.exit_at ?? t.entry_at, zona);
    const ember = peta.get(tanggal) ?? { pnl: 0, trades: 0, totalR: 0, denganR: 0 };
    ember.trades += 1;
    if (punyaPnl(t)) ember.pnl += t.net_pnl as number;
    const r = nilaiR(t);
    if (r !== null) {
      ember.totalR += r;
      ember.denganR += 1;
    }
    peta.set(tanggal, ember);
  }

  return Array.from(peta.entries())
    .map(([date, v]) => ({
      date,
      pnl: parseFloat(v.pnl.toFixed(2)),
      trades: v.trades,
      r: v.denganR > 0 ? parseFloat(v.totalR.toFixed(4)) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Kinerja per jam ENTRY.
 *
 * Sengaja memakai jam MASUK, bukan jam keluar: pertanyaan yang dijawab
 * tabel ini adalah "jam berapa entry saya paling bagus", dan jam keluar
 * sering ditentukan TP/SL, bukan oleh keputusan.
 */
export function kelompokPerJam(trades: Trade[], zona: string): EmberJam[] {
  const peta = new Map<number, {
    trades: number; selesai: number; menang: number;
    pnl: number; totalR: number; denganR: number;
  }>();

  for (const t of trades) {
    const { jam } = bagianWaktuLokal(t.entry_at, zona);
    const ember = peta.get(jam) ?? { trades: 0, selesai: 0, menang: 0, pnl: 0, totalR: 0, denganR: 0 };
    ember.trades += 1;
    if (sudahSelesai(t)) ember.selesai += 1;
    if (t.result === 'win') ember.menang += 1;
    if (punyaPnl(t)) ember.pnl += t.net_pnl as number;
    const r = nilaiR(t);
    if (r !== null) {
      ember.totalR += r;
      ember.denganR += 1;
    }
    peta.set(jam, ember);
  }

  return Array.from(peta.entries())
    .map(([jam, v]) => ({
      hour: `${String(jam).padStart(2, '0')}:00`,
      trades: v.trades,
      selesai: v.selesai,
      // Pembaginya trade SELESAI. Posisi terbuka belum menang dan belum
      // kalah; memasukkannya hanya menurunkan win rate secara semu.
      win_rate: v.selesai > 0 ? Math.round((v.menang / v.selesai) * 100) : 0,
      net_pnl: parseFloat(v.pnl.toFixed(2)),
      avg_r: v.denganR > 0 ? parseFloat((v.totalR / v.denganR).toFixed(4)) : null,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

/** Kurva R kumulatif pada urutan keluar — kurva ekuitas untuk trade
 *  yang tidak punya nominal sama sekali. */
export function kurvaEkuitasR(trades: Trade[], zona: string): Array<{ date: string; r: number }> {
  const berR = trades
    .map(t => ({ t, r: nilaiR(t) }))
    .filter((x): x is { t: Trade; r: number } => x.r !== null)
    .sort((a, b) => {
      const wa = new Date(a.t.exit_at ?? a.t.entry_at).getTime();
      const wb = new Date(b.t.exit_at ?? b.t.entry_at).getTime();
      if (wa !== wb) return wa - wb;
      return String(a.t.id).localeCompare(String(b.t.id));
    });

  let kumulatif = 0;
  return berR.map(({ t, r }) => {
    kumulatif += r;
    return {
      date: bagianWaktuLokal(t.exit_at ?? t.entry_at, zona).tanggal,
      r: parseFloat(kumulatif.toFixed(4)),
    };
  });
}
