-- ════════════════════════════════════════════════════════════════════
-- Perbaikan indeks anti-duplikat trades — 30 Okt 2026
-- ════════════════════════════════════════════════════════════════════
--
-- MASALAH
-- 20261030_bot_ingest.sql membuat indeks unik PARSIAL:
--   create unique index uniq_trades_user_external
--     on trades(user_id, external_id) where external_id is not null;
--
-- Bot mengirim lewat PostgREST upsert: on_conflict=user_id,external_id.
-- PostgREST menghasilkan `ON CONFLICT (user_id, external_id)` TANPA
-- klausa WHERE, sehingga Postgres tidak bisa memakai indeks parsial
-- sebagai arbiter -> error 42P10 pada SETIAP kiriman trade. Bot hanya
-- mencatat peringatan, jadi dari luar terlihat "jalan" padahal tidak
-- satu trade pun tersimpan.
--
-- Terbukti lewat uji di database (transaksi yang dibatalkan):
--   sebelum: INSERT trade baru & kirim ulang -> 42P10
--   sesudah: keduanya OK, kirim ulang tidak menggandakan baris
--
-- PERBAIKAN
-- Indeks unik biasa. Trade manual (external_id NULL) tetap aman karena
-- Postgres menganggap setiap NULL berbeda satu sama lain.
drop index if exists public.uniq_trades_user_external;

create unique index uniq_trades_user_external
  on public.trades (user_id, external_id);
