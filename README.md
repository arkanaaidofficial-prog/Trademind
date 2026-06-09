# TradeMind Journal

> Jurnal & evaluasi performa trading - crypto, forex, saham, futures, spot portfolio, dan bot trading.

## Tech Stack
- **Frontend**: Next.js 14 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Charts**: Recharts
- **Deployment**: Vercel

## Fitur MVP
- ✅ Authentication (Supabase Auth)
- ✅ CRUD Trade Journal (lengkap)
- ✅ Spot Portfolio dari trade spot
- ✅ Psychology Journal per trade
- ✅ Screenshot upload (Supabase Storage)
- ✅ Dashboard dengan equity curve, win rate, profit factor
- ✅ Analytics: by pair, strategy, emotion
- ✅ Trading Rules & pre-entry checklist
- ✅ Import CSV / Export CSV
- ✅ Dark mode, mobile-first

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY

# Jalankan schema di Supabase SQL Editor
# Buka: supabase/schema.sql → copy → paste di Supabase Dashboard > SQL Editor > Run

# Jika sudah pernah upload screenshot sebelum private storage patch,
# jalankan juga supabase/storage-legacy-path-policy.sql agar path lama tetap bisa dibaca.

# Dev server
npm run dev
```

## Storage Security

- Bucket `trade-screenshots` dibuat private oleh `supabase/schema.sql`.
- Screenshot trade disimpan sebagai storage path, bukan public URL permanen.
- Aplikasi membuat signed URL sementara saat preview/detail trade dibuka.
- Bucket `avatars` dibuat public khusus untuk foto profil.

## Struktur Project

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, Register
│   └── (dashboard)/        # Dashboard, Trades, Spot, Analytics, Bot, Reviews, Rules
├── components/             # UI Components
├── hooks/                  # Custom React hooks
├── lib/
│   ├── supabase/           # Supabase client helpers
│   ├── calculations/       # Stats, spot holdings, drawdown, equity curve
│   └── validators/         # Zod schemas
└── types/                  # TypeScript types
```

## Roadmap

| Fase | Fitur |
|------|-------|
| MVP | Auth, CRUD Trade, Dashboard, Analytics dasar, Rules |
| v1.0 | Psychology Journal, Screenshot upload, Reviews, Bot Journal, Import/Export |
| v1.5 | Analytics Pro, Spot Portfolio, Equity simulation, Heatmap, Drawdown analysis |
| v2.0 | Subscription, API key untuk bot sync, AI insight |

---
Built with care for serious traders.