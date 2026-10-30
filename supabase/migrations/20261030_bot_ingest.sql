-- ════════════════════════════════════════════════════════════════════
-- Jalur masuk untuk bot (bot-futures, CoinRadar) — 30 Okt 2026
-- ════════════════════════════════════════════════════════════════════
--
-- MASALAH YANG DIPECAHKAN
--
-- Bot perlu menulis ke Supabase. Tiga cara yang mungkin:
--
--   1. service_role key  -> melewati RLS SEPENUHNYA. Kalau kunci bocor
--      dari VPS, seluruh database terbuka: baca, ubah, hapus. Ditolak.
--
--   2. Bot memakai akun Bapak sendiri -> bot memegang kredensial penuh
--      pemilik. Kalau bocor, penyerang masuk sebagai Bapak. Ditolak.
--
--   3. Akun bot TERPISAH + izin sempit  <-- yang dipakai di sini.
--
-- Tapi cara ke-3 punya jebakan: akun bot punya `auth.uid()` sendiri,
-- sedangkan policy lama berbunyi `auth.uid() = user_id`. Artinya trade
-- yang ditulis bot akan ber-`user_id` milik BOT, dan TIDAK AKAN MUNCUL
-- di jurnal Bapak. Integrasinya akan terlihat "berhasil" padahal datanya
-- tidak pernah terlihat.
--
-- Berkas ini menutup jebakan itu: bot menulis baris ber-`user_id` MILIK
-- BAPAK, dan hanya boleh melakukan itu.
--
-- BATAS KEWENANGAN AKUN BOT — sengaja sesempit mungkin
--
--   trades    : INSERT saja. Tidak boleh SELECT, UPDATE, maupun DELETE.
--               Rekam jejak jadi tambah-saja; bot tidak bisa merapikan
--               sejarahnya sendiri, sengaja atau tidak.
--   bot_logs  : INSERT + UPDATE (perlu untuk upsert harian), hanya baris
--               milik pemiliknya.
--   sisanya   : tidak ada akses sama sekali.
--
-- Kalau kredensial bot bocor dari VPS, yang bisa dilakukan penyerang
-- hanyalah MENYISIPKAN trade palsu. Ia tidak bisa membaca satu baris pun,
-- tidak bisa mengubah, tidak bisa menghapus. Itu kerusakan yang bisa
-- dibersihkan, bukan bencana.

-- ── 1. Daftar pemberian izin ────────────────────────────────────────
-- Satu baris = satu akun bot yang boleh menulis atas nama satu pemilik.
-- Menambah/mencabut bot cukup menambah/menghapus baris, bukan migrasi.
create table if not exists public.bot_ingest_grants (
  bot_uid    uuid primary key,
  owner_uid  uuid not null references public.profiles(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

alter table public.bot_ingest_grants enable row level security;

-- Hanya pemilik yang boleh melihat & mengelola pemberian izin miliknya.
-- Akun bot TIDAK bisa membaca tabel ini — ia tidak perlu tahu.
drop policy if exists "bot_ingest_grants_own" on public.bot_ingest_grants;
create policy "bot_ingest_grants_own" on public.bot_ingest_grants
  for all using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());

-- ── 2. Penerjemah UID bot -> UID pemilik ────────────────────────────
-- WAJIB `security definer`: policy di bawah memanggilnya dari konteks
-- akun bot, yang tidak punya hak baca ke bot_ingest_grants. Tanpa ini
-- subquery-nya mengembalikan kosong dan seluruh izin gagal diam-diam.
-- `search_path` dipatok supaya fungsi ini tidak bisa dibajak lewat
-- skema bayangan.
create or replace function public.bot_owner_of(p_bot uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select owner_uid from public.bot_ingest_grants where bot_uid = p_bot
$$;

revoke all on function public.bot_owner_of(uuid) from public;
grant execute on function public.bot_owner_of(uuid) to authenticated;

-- ── 3. Kunci anti-duplikat ──────────────────────────────────────────
-- Bot bisa mengirim ulang kejadian yang sama: scan diulang, kontainer
-- restart, jaringan putus setelah server menerima tapi sebelum jawaban
-- sampai. Tanpa kunci ini, satu posisi bisa tercatat berkali-kali dan
-- seluruh statistik winrate ikut rusak.
--
-- `external_id` diisi id sinyal dari bot (signal_tracking.signal_id).
-- Indeksnya PARSIAL supaya trade manual (external_id NULL) tidak
-- terganggu — NULL tidak pernah bentrok.
alter table public.trades add column if not exists external_id text;

create unique index if not exists uniq_trades_user_external
  on public.trades(user_id, external_id)
  where external_id is not null;

-- Satu baris ringkasan per bot per hari, supaya bisa di-upsert.
create unique index if not exists uniq_bot_logs_bot_date
  on public.bot_logs(bot_id, log_date);

-- ── 4. Izin tulis untuk akun bot ────────────────────────────────────
-- trades: INSERT SAJA. Tidak ada policy select/update/delete untuk bot,
-- jadi ketiganya tertutup rapat.
drop policy if exists "trades_bot_insert" on public.trades;
create policy "trades_bot_insert" on public.trades
  for insert to authenticated
  with check (
    user_id = public.bot_owner_of(auth.uid())
    and mode = 'bot'          -- bot tidak boleh menyamar jadi trade manual
  );

-- bot_logs: INSERT + UPDATE, keduanya terbatas pada baris milik pemilik.
drop policy if exists "bot_logs_bot_insert" on public.bot_logs;
create policy "bot_logs_bot_insert" on public.bot_logs
  for insert to authenticated
  with check (user_id = public.bot_owner_of(auth.uid()));

drop policy if exists "bot_logs_bot_update" on public.bot_logs;
create policy "bot_logs_bot_update" on public.bot_logs
  for update to authenticated
  using (user_id = public.bot_owner_of(auth.uid()))
  with check (user_id = public.bot_owner_of(auth.uid()));

-- ── 5. Catatan pemasangan ───────────────────────────────────────────
-- Setelah migrasi ini dijalankan:
--
--   a. Buat akun Supabase khusus bot (Authentication > Users > Add user),
--      misal bot@trademind.local, dengan sandi acak panjang.
--   b. Salin UID akun bot itu.
--   c. Dari akun BAPAK (bukan akun bot), jalankan:
--
--        insert into public.bot_ingest_grants (bot_uid, owner_uid, label)
--        values ('<UID-BOT>', auth.uid(), 'bot-futures VPS');
--
--   d. Buat baris bot_configs lewat UI Trademind, salin id-nya ke
--      TRADEMIND_BOT_ID di .env VPS.
--
-- Mencabut akses bot cukup: delete from bot_ingest_grants where bot_uid = '...';
-- Tidak perlu mengganti sandi, tidak perlu redeploy.
