-- Add account type so crypto spot is separated from futures and margin.
-- Existing rows default to spot to keep the MVP usable.

alter table public.trades
  add column if not exists trade_account_type text
  check (trade_account_type in ('spot','futures','margin'))
  default 'spot';

create index if not exists idx_trades_account_type on public.trades(trade_account_type);
