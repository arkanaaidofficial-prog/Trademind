// src/lib/calculations/ekskursi.ts
//
// MAE (Maximum Adverse Excursion) dan MFE (Maximum Favourable Excursion).
//
// Ini satu-satunya dua angka di jurnal yang bisa menjawab:
//
//     MAE pada trade MENANG   -> apakah stop saya terlalu ketat?
//     MFE lawan R yang diraih -> apakah saya keluar terlalu cepat?
//
// Trade yang menang +2R setelah sempat tertekan -0,9R adalah cerita yang
// sama sekali berbeda dari yang menang +2R tanpa pernah tertekan. Win
// rate, expectancy, dan profit factor semuanya BUTA terhadap perbedaan
// itu — mereka hanya melihat titik akhir.
//
// Disimpan sebagai HARGA (mae_price / mfe_price), bukan persen dan bukan
// R. Pelajaran dari cacat satuan `fee`: kolom uang diisi angka persen
// oleh bot dan tidak ada yang sadar sampai diaudit. Harga tidak punya
// satuan yang bisa tertukar, dan tabel sudah menyimpan entry_price +
// stop_loss sehingga sisanya bisa diturunkan di sini.

import type { Trade, StatistikEkskursi } from '@/types/trade';
import { nilaiR } from './stats';
import { MIN_SAMPEL_LAYAK } from './stats';

/**
 * Ambang MAE pada trade yang MENANG, dalam R.
 *
 * Kalau trade yang AKHIRNYA menang rutin tertekan sampai 0,8R, stop yang
 * sedikit lebih ketat akan membunuhnya sebelum ia sempat bekerja.
 */
export const AMBANG_MAE_MENANG = 0.8;

/**
 * Ambang efisiensi: bagian dari gerakan tersedia yang berhasil ditangkap.
 * Di bawah setengahnya, separuh keuntungan ditinggalkan di meja.
 */
export const AMBANG_EFISIENSI = 0.5;

function angka(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Jarak stop loss dari harga masuk, dalam persen. Selalu positif.
 *  null kalau SL tidak dicatat atau sama persis dengan harga masuk —
 *  tanpa jarak, tidak ada 1R untuk dijadikan satuan. */
export function jarakSlPct(t: Trade): number | null {
  const entry = angka(t.entry_price);
  const sl = angka(t.stop_loss);
  if (entry === null || sl === null || entry <= 0) return null;
  const jarak = Math.abs(entry - sl) / entry * 100;
  return jarak > 0 ? jarak : null;
}

/** Arah -1 untuk short, +1 untuk long, null kalau tidak dikenal. */
function arah(t: Trade): number | null {
  const p = String(t.position_type ?? '').toLowerCase();
  if (p === 'long') return 1;
  if (p === 'short') return -1;
  return null;
}

/**
 * Besar ekskursi dalam R.
 *
 * `tanda` = +1 untuk sisi yang MENDUKUNG posisi (MFE), −1 untuk sisi yang
 * MELAWAN (MAE). Hasilnya selalu dinyatakan sebagai besaran positif.
 *
 * null — BUKAN nol — kalau arahnya salah. MAE sebuah LONG tidak mungkin
 * berada di ATAS harga masuk; memotongnya jadi nol akan berbunyi "tidak
 * pernah tertekan sedikit pun", kesimpulan paling berbahaya yang bisa
 * diambil dari data yang rusak.
 */
function ekskursiR(t: Trade, harga: number | null, tanda: 1 | -1): number | null {
  const entry = angka(t.entry_price);
  const a = arah(t);
  const jarak = jarakSlPct(t);
  if (harga === null || entry === null || a === null || jarak === null || entry <= 0) {
    return null;
  }
  // Selisih searah posisi: positif berarti menguntungkan.
  const searah = (harga - entry) / entry * 100 * a;
  const besar = searah * tanda;
  if (besar < 0) return null;         // data tidak masuk akal
  return parseFloat((besar / jarak).toFixed(8));
}

/** Seberapa jauh harga bergerak MELAWAN posisi, dalam R. */
export function maeR(t: Trade): number | null {
  return ekskursiR(t, angka(t.mae_price), -1);
}

/** Seberapa jauh harga bergerak MENDUKUNG posisi, dalam R. */
export function mfeR(t: Trade): number | null {
  return ekskursiR(t, angka(t.mfe_price), 1);
}

function rata(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

/** Persentil dengan interpolasi linier. */
function persentil(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const u = [...xs].sort((a, b) => a - b);
  if (u.length === 1) return u[0];
  const pos = (u.length - 1) * p;
  const bawah = Math.floor(pos);
  const sisa = pos - bawah;
  if (bawah + 1 >= u.length) return u[u.length - 1];
  return u[bawah] + sisa * (u[bawah + 1] - u[bawah]);
}

export function calcStatistikEkskursi(trades: Trade[]): StatistikEkskursi {
  const mae: number[] = [];
  const mfe: number[] = [];
  const maeMenang: number[] = [];
  const mfeKalah: number[] = [];
  // Pasangan R-diraih dan R-tersedia, hanya dari baris yang punya KEDUANYA.
  const rDiraih: number[] = [];
  const rTersedia: number[] = [];

  for (const t of trades) {
    const a = maeR(t);
    const f = mfeR(t);
    if (a !== null) {
      mae.push(a);
      if (t.result === 'win') maeMenang.push(a);
    }
    if (f !== null) {
      mfe.push(f);
      if (t.result === 'loss') mfeKalah.push(f);
      const r = nilaiR(t);
      if (r !== null) { rDiraih.push(r); rTersedia.push(f); }
    }
  }

  const maeRataMenang = rata(maeMenang);
  const rataDiraih = rata(rDiraih);
  const rataTersedia = rata(rTersedia);
  const efisiensi =
    rataDiraih !== null && rataTersedia !== null && rataTersedia > 0
      ? rataDiraih / rataTersedia
      : null;

  // Sampel dinilai pada kelompok yang MENENTUKAN vonis masing-masing,
  // bukan pada jumlah baris keseluruhan.
  const cukupMae = maeMenang.length >= MIN_SAMPEL_LAYAK;
  const cukupEfisiensi = rDiraih.length >= MIN_SAMPEL_LAYAK;

  return {
    trades_dengan_mae: mae.length,
    trades_dengan_mfe: mfe.length,
    mae_rata: rata(mae),
    mae_rata_menang: maeRataMenang,
    mae_p90_menang: persentil(maeMenang, 0.9),
    mfe_rata: rata(mfe),
    mfe_rata_kalah: rata(mfeKalah),
    efisiensi,
    // null = BELUM TAHU. false = sudah diperiksa, aman. Dua hal berbeda,
    // dan menyamakannya adalah cara paling halus untuk berbohong.
    stop_terlalu_ketat:
      cukupMae && maeRataMenang !== null ? maeRataMenang >= AMBANG_MAE_MENANG : null,
    keluar_terlalu_cepat:
      cukupEfisiensi && efisiensi !== null ? efisiensi < AMBANG_EFISIENSI : null,
    cukup_sampel: cukupMae && cukupEfisiensi,
  };
}
