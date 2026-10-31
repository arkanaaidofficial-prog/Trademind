-- =====================================================
-- 31 Okt 2026 — MAE / MFE
--
-- MAE (Maximum Adverse Excursion) = sejauh mana harga bergerak MELAWAN
-- posisi sebelum ia selesai. MFE (Maximum Favourable Excursion) =
-- sejauh mana ia bergerak MENDUKUNG.
--
-- Dua angka ini menjawab pertanyaan yang TIDAK BISA dijawab kolom lain
-- mana pun di tabel ini:
--
--     MAE pada trade MENANG  -> apakah stop terlalu ketat?
--     MFE lawan R yang diraih -> apakah keluar terlalu cepat?
--
-- Trade yang menang +2R setelah sempat -0,9R melawan adalah cerita yang
-- sama sekali berbeda dari yang menang +2R tanpa pernah tertekan, dan
-- sampai sekarang jurnal ini tidak punya cara membedakannya.
--
-- DISIMPAN SEBAGAI HARGA, BUKAN PERSEN DAN BUKAN R.
-- Pelajaran dari cacat satuan `fee`: kolom bersatuan uang diisi angka
-- persen oleh bot dan tidak ada yang sadar sampai diaudit. Harga tidak
-- punya satuan yang bisa tertukar, dan tabel ini sudah menyimpan
-- entry_price + stop_loss sehingga persen maupun R bisa diturunkan.
--
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang.
-- =====================================================

alter table trades add column if not exists mae_price numeric(20,8);
alter table trades add column if not exists mfe_price numeric(20,8);

comment on column trades.mae_price is
  'Harga TEREKSTREM yang melawan posisi selama ia terbuka. '
  'LONG: harga terendah. SHORT: harga tertinggi. '
  'null = tidak diketahui (BUKAN nol).';

comment on column trades.mfe_price is
  'Harga TEREKSTREM yang mendukung posisi selama ia terbuka. '
  'LONG: harga tertinggi. SHORT: harga terendah. '
  'null = tidak diketahui (BUKAN nol).';

-- Tidak ada perubahan policy yang diperlukan: policy jalur masuk bot
-- bekerja per BARIS (mode = 'bot', user_id = bot_owner_of(auth.uid())),
-- bukan per kolom. Kolom baru otomatis ikut tercakup.
--
-- Tidak ada indeks: kedua kolom ini hanya dibaca saat menghitung
-- ringkasan atas baris yang sudah disaring user_id, tidak pernah jadi
-- syarat pencarian sendiri.
