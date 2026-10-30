-- ════════════════════════════════════════════════════════════════════
-- Jalur masuk CoinRadar — 30 Okt 2026
-- ════════════════════════════════════════════════════════════════════
--
-- Lanjutan dari 20261030_bot_ingest.sql. Berkas itu membuka jalur untuk
-- bot-futures (tabel `trades` + `bot_logs`). Berkas ini menambahkan
-- `coin_watchlist` untuk CoinRadar.
--
-- KENAPA WATCHLIST, BUKAN TRADES
--
-- Alert CoinRadar adalah saran untuk DIPANTAU, bukan posisi yang sudah
-- dibuka. Mencatatnya sebagai `trades` akan mencemari winrate dengan
-- sesuatu yang tidak pernah dieksekusi - persis kesalahan yang membuat
-- rekam jejak bot-futures sempat bias.
--
-- AKUN TERPISAH DISARANKAN
--
-- CoinRadar sebaiknya memakai akun bot SENDIRI, berbeda dari bot-futures,
-- supaya izinnya bisa dicabut sendiri-sendiri. Keduanya cukup didaftarkan
-- di `bot_ingest_grants` yang sudah ada.
--
-- CATATAN KEAMANAN YANG MENENTUKAN URUTAN
--
-- Sampai 30 Okt 2026, port 8000 CoinRadar terbuka ke internet TANPA
-- autentikasi. Memberi kunci tulis Supabase kepada layanan terbuka adalah
-- hal yang tidak boleh dilakukan. Penguncian API key dikerjakan LEBIH
-- DULU di repo Crypto-radar; migrasi ini menyusul.

-- ── Kunci anti-duplikat ─────────────────────────────────────────────
-- CoinRadar memindai tiap 30 menit dan bisa mengirim alert yang sama
-- berkali-kali. Tanpa kunci ini watchlist akan dipenuhi baris kembar.
--
-- Diisi "coinradar:<SIMBOL>:<created_at>" dari sisi bot.
--
-- INDEKS BIASA, BUKAN PARSIAL. Versi pertama saya memakai indeks parsial
-- `where external_id is not null` dan itu SALAH - kesalahan yang sama
-- sudah terjadi pada tabel `trades` dan harus diperbaiki terpisah di
-- 20261030_bot_ingest_fix_unique_index.sql.
--
-- Sebabnya: bot mengirim lewat PostgREST upsert
-- (on_conflict=user_id,external_id). PostgREST menghasilkan
-- `ON CONFLICT (user_id, external_id)` TANPA klausa WHERE, sehingga
-- Postgres tidak bisa memakai indeks parsial sebagai arbiter -> error
-- 42P10 pada SETIAP kiriman. Bot hanya mencatat peringatan, jadi dari
-- luar terlihat "jalan" padahal tidak satu baris pun tersimpan.
--
-- Watchlist MANUAL (external_id NULL) tetap aman: Postgres menganggap
-- setiap NULL berbeda satu sama lain, jadi indeks biasa pun tidak
-- memblokir banyak baris ber-NULL.
alter table public.coin_watchlist
  add column if not exists external_id text;

drop index if exists public.uniq_coin_watchlist_user_external;

create unique index uniq_coin_watchlist_user_external
  on public.coin_watchlist (user_id, external_id);

-- ── Izin tulis untuk akun bot ───────────────────────────────────────
-- INSERT + UPDATE saja. Tidak ada policy select/delete untuk bot, jadi
-- keduanya tertutup rapat: bot tidak bisa membaca rencana dagang Bapak,
-- dan tidak bisa menghapus apa pun.
--
-- UPDATE diperlukan karena kiriman memakai upsert (merge-duplicates):
-- harga dan skor sebuah coin berubah antar scan, dan barisnya harus ikut
-- diperbarui, bukan digandakan.
--
-- `bot_owner_of()` sudah didefinisikan di 20261030_bot_ingest.sql.
drop policy if exists "coin_watchlist_bot_insert" on public.coin_watchlist;
create policy "coin_watchlist_bot_insert" on public.coin_watchlist
  for insert to authenticated
  with check (
    user_id = public.bot_owner_of(auth.uid())
    -- bot tidak boleh menyamar jadi entri manual Bapak
    and source_type = 'other'
    and external_id is not null
  );

drop policy if exists "coin_watchlist_bot_update" on public.coin_watchlist
;
create policy "coin_watchlist_bot_update" on public.coin_watchlist
  for update to authenticated
  using (
    user_id = public.bot_owner_of(auth.uid())
    and external_id is not null
  )
  with check (
    user_id = public.bot_owner_of(auth.uid())
    and external_id is not null
  );

-- ── Catatan pemasangan ──────────────────────────────────────────────
--
--   a. Buat akun Supabase kedua, misal coinradar@trademind.local
--   b. Salin UID-nya
--   c. Dari akun BAPAK:
--
--        insert into public.bot_ingest_grants (bot_uid, owner_uid, label)
--        values ('<UID-COINRADAR>', auth.uid(), 'CoinRadar VPS');
--
--   d. Buat baris bot_configs kedua lewat UI Trademind
--      (nama: CoinRadar, exchange: multi, mode: live)
--   e. Isi TRADEMIND_* di .env CoinRadar dengan kredensial akun INI,
--      bukan akun bot-futures.
--
-- Mencabut akses CoinRadar saja, tanpa menyentuh bot-futures:
--   delete from public.bot_ingest_grants where label = 'CoinRadar VPS';
