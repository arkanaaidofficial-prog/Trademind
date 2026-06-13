// src/types/trade.ts
// Core domain types for TradeMind Journal

import type { TradeAccountType } from './trade-account';

export type MarketType = 'crypto' | 'forex' | 'saham' | 'futures' | 'other';
export type PositionType = 'long' | 'short';
export type TradeMode = 'manual' | 'bot' | 'copytrade' | 'signal';
export type TradeResult = 'win' | 'loss' | 'breakeven';
export type SetupType = 'breakout' | 'pullback' | 'trend_following' | 'reversal' | 'scalping' | 'news' | 'range' | 'other';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W';
export type MarketCondition = 'trending' | 'ranging' | 'volatile' | 'low_volume' | 'high_volume';
export type EmotionType = 'tenang' | 'takut' | 'FOMO' | 'serakah' | 'ragu' | 'revenge_trading' | 'percaya_diri_berlebihan' | 'percaya_diri';
export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type ScreenshotStage = 'before' | 'during' | 'after';

export interface Trade {
  id: string;
  user_id: string;

  // Classification
  market_type: MarketType;
  trade_account_type?: TradeAccountType;
  exchange?: string;
  symbol: string;
  position_type: PositionType;
  mode: TradeMode;

  // Bot info
  bot_id?: string;
  bot_name?: string;
  bot_version?: string;

  // Strategy
  strategy_id?: string;
  strategy_name?: string;
  setup_type?: SetupType;
  timeframe?: Timeframe;

  // Timing
  entry_at: string;
  exit_at?: string;
  duration_minutes?: number;

  // Pricing
  entry_price: number;
  exit_price?: number;

  // Position sizing
  position_size?: number;
  leverage?: number;
  margin_used?: number;

  // Risk management
  stop_loss?: number;
  take_profit?: number;
  risk_amount?: number;
  risk_percent?: number;
  reward_target?: number;
  rr_ratio?: number;

  // Financial
  fee?: number;
  funding_fee?: number;
  gross_pnl?: number;
  net_pnl?: number;
  result?: TradeResult;
  r_multiple?: number;

  // Context
  market_condition?: MarketCondition;
  entry_reason?: string;
  exit_reason?: string;
  mistake_notes?: string;
  lesson_learned?: string;
  tags?: string[];

  // Flags
  rule_violations?: RuleViolation[];

  created_at: string;
  updated_at: string;

  // Relations (optional, from joins)
  psychology?: TradePsychology;
  screenshots?: TradeScreenshot[];
}

export interface TradePsychology {
  id: string;
  trade_id: string;
  user_id: string;

  emotion_before?: EmotionType;
  emotion_during?: string;
  emotion_after?: string;

  followed_plan_entry?: boolean;
  followed_plan_exit?: boolean;
  moved_sl_invalid?: boolean;
  moved_tp_emotion?: boolean;
  overtraded?: boolean;
  revenge_trade?: boolean;
  oversized?: boolean;

  discipline_score?: number;
  setup_quality_score?: number;
  notes?: string;

  created_at: string;
}

export interface TradeScreenshot {
  id: string;
  trade_id: string;
  user_id: string;
  stage: ScreenshotStage;
  storage_path: string;
  caption?: string;
  created_at: string;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  rules?: string;
  is_active: boolean;
  created_at: string;
}

export interface BotConfig {
  id: string;
  user_id: string;
  name: string;
  version?: string;
  mode: 'paper' | 'live';
  exchange?: string;
  strategy?: string;
  parameters?: Record<string, unknown>;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TradingRules {
  id: string;
  user_id: string;
  max_risk_per_trade_pct?: number;
  max_trades_per_day?: number;
  max_daily_loss?: number;
  max_weekly_loss?: number;
  allowed_hours_start?: string;
  allowed_hours_end?: string;
  allowed_pairs?: string[];
  allowed_market_types?: MarketType[];
  entry_checklist?: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  note?: string;
  required: boolean;
}

export interface Review {
  id: string;
  user_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  what_worked?: string;
  biggest_mistake?: string;
  main_lesson?: string;
  strategy_continue?: string;
  strategy_stop?: string;
  risk_management_ok?: boolean;
  improvement_plan?: string;
  overall_rating?: number;
  stats_snapshot?: DashboardStats;
  created_at: string;
  updated_at: string;
}

export interface RuleViolation {
  rule: string;
  violated_at: string;
  details?: string;
}

// Analytics types
export interface DashboardStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  breakeven_trades: number;
  win_rate: number;
  gross_pnl: number;
  net_pnl: number;
  total_fee: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  expectancy: number;
  max_drawdown: number;
  best_trade_pnl: number;
  worst_trade_pnl: number;
  best_pair: string;
  worst_pair: string;
  best_strategy: string;
  worst_strategy: string;
}

export interface PerformanceByDimension {
  label: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
  gross_pnl: number;
  net_pnl: number;
  avg_pnl: number;
}

export interface TradeFilter {
  symbol?: string;
  market_type?: MarketType | 'all';
  trade_account_type?: TradeAccountType | 'all';
  mode?: TradeMode | 'all';
  result?: TradeResult | 'all';
  strategy_name?: string;
  timeframe?: Timeframe | 'all';
  date_from?: string;
  date_to?: string;
  emotion_before?: EmotionType | 'all';
}
