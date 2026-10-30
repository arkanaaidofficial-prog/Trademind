/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // [30 Okt 2026] DINYALAKAN KEMBALI. Sebelumnya true, dan di balik
    // saklar itu ada 8 galat tipe yang ikut terbit ke produksi -
    // termasuk dua pembacaan `pending` yang mungkin null. Kedelapannya
    // sudah diperbaiki, jadi galat tipe baru sekarang MENGGAGALKAN build.
    // Itu memang yang diinginkan: gagal yang berisik lebih baik daripada
    // galat yang diam.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Masih true, dan ini DIAKUI sebagai utang, bukan pilihan: repo ini
    // belum punya berkas konfigurasi ESLint sama sekali, jadi `next lint`
    // hanya menawarkan wizard penyiapan. Menyalakannya tanpa konfigurasi
    // akan menggagalkan build tanpa memberi satu pun temuan berguna.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
}

module.exports = nextConfig
