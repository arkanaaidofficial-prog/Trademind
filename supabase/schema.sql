-- =====================================================
-- TradeMind Journal - Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- =====================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── PROFILES ─────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  timezone text default 'Asia/Jakarta',
  currency text default 'USD',
  account_balance numeric(20,2) default 10000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── STRATEGIES ───────────────────────────────────────────────
create table strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  rules text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── BOT CONFIGS ──────────────────────────────────────────────
create table bot_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  version text,
  mode text check (mode in ('paper', 'live')) default 'paper',
  exchange text,
  strategy text,
  parameters jsonb default '{}',
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TRADES (Core Table) ──────────────────────────────────────
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,

  -- Classification
  market_type text check (market_type in ('crypto','forex','saham','futures','other')) default 'crypto',
  exchange text,
  symbol text not null,
  position_type text check (position_type in ('long','short')) not null,
  mode text check (mode in ('manual','bot','copytrade','signal')) default 'manual',

  -- Bot info (nullable)
  bot_id uuid references bot_configs(id) on delete set null,
  bot_name text,
  bot_version text,

  -- Strategy
  strategy_id uuid references strategies(id) on delete set null,
  strategy_name text,
  setup_type text check (setup_type in (
    'breakout','pullback','trend_following','reversal','scalping',
    'news','range','other'
  )),
  timeframe text check (timeframe in ('1m','5m','15m','30m','1H','4H','1D','1W')),

  -- Timing
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  duration_minutes integer,

  -- Pricing
  entry_price numeric(20,8) not null,
  exit_price numeric(20,8),

  -- Position sizing
  position_size numeric(20,8),
  leverage numeric(5,2) default 1,
  margin_used numeric(20,8),

  -- Risk management
  stop_loss numeric(20,8),
  take_profit numeric(20,8),
  risk_amount numeric(20,8),
  risk_percent numeric(5,2),
  reward_target numeric(20,8),
  rr_ratio numeric(8,2),

  -- Financial results
  fee numeric(20,8) default 0,
  funding_fee numeric(20,8) default 0,
  gross_pnl numeric(20,8),
  net_pnl numeric(20,8),
  result text check (result in ('win','loss','breakeven')),
  r_multiple numeric(8,2),

  -- Context
  market_condition text check (market_condition in (
    'trending','ranging','volatile','low_volume','high_volume'
  )),
  entry_reason text,
  exit_reason text,
  mistake_notes text,
  lesson_learned text,
  tags text[] default '{}',

  -- Rule violation flags (array of violated rule names)
  rule_violations jsonb default '[]',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TRADE PSYCHOLOGY ─────────────────────────────────────────
create table trade_psychology (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,

  -- Emotional states
  emotion_before text check (emotion_before in (
    'tenang','takut','FOMO','serakah','ragu','revenge_trading',
    'percaya_diri_berlebihan','percaya_diri'
  )),
  emotion_during text,
  emotion_after text,

  -- Discipline flags
  followed_plan_entry boolean,
  followed_plan_exit boolean,
  moved_sl_invalid boolean default false,
  moved_tp_emotion boolean default false,
  overtraded boolean default false,
  revenge_trade boolean default false,
  oversized boolean default false,

  -- Scores
  discipline_score integer check (discipline_score between 1 and 10),
  setup_quality_score integer check (setup_quality_score between 1 and 10),

  notes text,
  created_at timestamptz default now(),

  unique(trade_id)
);

-- ─── TRADE SCREENSHOTS ────────────────────────────────────────
create table trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  stage text check (stage in ('before','during','after')) not null,
  storage_path text not null,  -- Supabase Storage path
  caption text,
  created_at timestamptz default now()
);

-- ─── TRADING RULES ────────────────────────────────────────────
create table trading_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,

  max_risk_per_trade_pct numeric(5,2) default 2.0,
  max_trades_per_day integer default 3,
  max_daily_loss numeric(10,2),
  max_weekly_loss numeric(10,2),

  allowed_hours_start time,
  allowed_hours_end time,

  allowed_pairs text[] default '{}',
  allowed_market_types text[] default '{crypto}',
  allowed_strategy_ids uuid[] default '{}',

  entry_checklist jsonb default '[]',  -- [{id: uuid, text: string, required: bool}]

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)  -- one rules doc per user
);

-- ─── REVIEWS ──────────────────────────────────────────────────
create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,

  period_type text check (period_type in ('daily','weekly','monthly')) not null,
  period_start date not null,
  period_end date not null,

  what_worked text,
  biggest_mistake text,
  main_lesson text,
  strategy_continue text,
  strategy_stop text,
  risk_management_ok boolean,
  improvement_plan text,
  overall_rating integer check (overall_rating between 1 and 10),

  -- Snapshot of stats at review time
  stats_snapshot jsonb default '{}',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, period_type, period_start)
);

-- ─── BOT LOGS ─────────────────────────────────────────────────
create table bot_logs (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references bot_configs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,

  log_date date not null default current_date,
  total_signals integer default 0,
  valid_signals integer default 0,
  failed_signals integer default 0,
  executed_entries integer default 0,
  skipped_entries integer default 0,
  gross_pnl numeric(20,8) default 0,
  net_pnl numeric(20,8) default 0,
  max_drawdown numeric(10,2),

  bug_notes text,
  raw_data jsonb default '{}',

  created_at timestamptz default now()
);

-- ─── IMPORTS ──────────────────────────────────────────────────
create table imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  filename text,
  source text,  -- 'csv', 'json', 'exchange_api'
  rows_total integer default 0,
  rows_success integer default 0,
  rows_failed integer default 0,
  errors jsonb default '[]',
  created_at timestamptz default now()
);

-- ─── INDEXES ──────────────────────────────────────────────────
create index idx_trades_user_id on trades(user_id);
create index idx_trades_entry_at on trades(entry_at desc);
create index idx_trades_symbol on trades(symbol);
create index idx_trades_result on trades(result);
create index idx_trades_mode on trades(mode);
create index idx_trades_strategy_name on trades(strategy_name);
create index idx_trade_psychology_trade_id on trade_psychology(trade_id);
create index idx_trade_screenshots_trade_id on trade_screenshots(trade_id);
create index idx_reviews_user_period on reviews(user_id, period_type, period_start);
create index idx_bot_logs_bot_id on bot_logs(bot_id, log_date);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table profiles enable row level security;
alter table strategies enable row level security;
alter table trades enable row level security;
alter table trade_psychology enable row level security;
alter table trade_screenshots enable row level security;
alter table trading_rules enable row level security;
alter table reviews enable row level security;
alter table bot_configs enable row level security;
alter table bot_logs enable row level security;
alter table imports enable row level security;

-- Profiles: user can only see/edit own profile
create policy "profiles_own" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Generic "own data" policies
create policy "strategies_own" on strategies for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trades_own" on trades for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trade_psychology_own" on trade_psychology for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trade_screenshots_own" on trade_screenshots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trading_rules_own" on trading_rules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reviews_own" on reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bot_configs_own" on bot_configs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bot_logs_own" on bot_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "imports_own" on imports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── AUTO-CREATE PROFILE ON REGISTER ─────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── STORAGE BUCKET (run after creating bucket in dashboard) ──
-- Bucket name: trade-screenshots
-- Policy: authenticated users can only access their own folder (user_id/*)
-- Set up via: Storage > Policies in Supabase Dashboard
