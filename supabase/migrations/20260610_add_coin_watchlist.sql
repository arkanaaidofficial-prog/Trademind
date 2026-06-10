-- Coin watchlist for ideas gathered from Telegram, WhatsApp, Twitter/X, and other sources.
-- Run this after the base schema in the Supabase SQL Editor.

create table if not exists public.coin_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  symbol text not null,
  market_type text not null default 'crypto' check (market_type in ('crypto','forex','saham','futures','other')),

  source_type text not null default 'manual' check (source_type in ('telegram','whatsapp','twitter','youtube','news','manual','other')),
  source_name text,
  source_url text,

  watch_status text not null default 'watching' check (watch_status in ('watching','planned','entered','skipped','archived')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  conviction_score integer not null default 5 check (conviction_score between 1 and 10),

  current_price numeric(20,8),
  planned_entry numeric(20,8),
  target_price numeric(20,8),
  stop_loss numeric(20,8),

  thesis text,
  risk_notes text,
  tags text[] not null default '{}'::text[],

  added_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint coin_watchlist_symbol_not_blank check (length(trim(symbol)) > 0)
);

create index if not exists idx_coin_watchlist_user_status
  on public.coin_watchlist(user_id, watch_status);

create index if not exists idx_coin_watchlist_user_symbol
  on public.coin_watchlist(user_id, symbol);

create index if not exists idx_coin_watchlist_user_source
  on public.coin_watchlist(user_id, source_type);

grant select, insert, update, delete on table public.coin_watchlist to authenticated;

alter table public.coin_watchlist enable row level security;

drop policy if exists "coin_watchlist_own" on public.coin_watchlist;
create policy "coin_watchlist_own"
  on public.coin_watchlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
