// src/lib/validators/tradeSchema.ts
// Zod schemas for trade form validation

import { z } from 'zod';

export const tradeFormSchema = z.object({
  // Core
  symbol: z.string().min(1, 'Symbol wajib diisi').max(20).transform(v => v.toUpperCase()),
  market_type: z.enum(['crypto', 'forex', 'saham', 'futures', 'other']).default('crypto'),
  trade_account_type: z.enum(['spot', 'futures', 'margin']).default('spot'),
  exchange: z.string().optional(),
  position_type: z.enum(['long', 'short'], { required_error: 'Pilih Long atau Short' }),
  mode: z.enum(['manual', 'bot', 'copytrade', 'signal']).default('manual'),

  // Bot (optional, only required if mode = 'bot')
  bot_name: z.string().optional(),
  bot_version: z.string().optional(),

  // Strategy
  strategy_name: z.string().optional(),
  setup_type: z.enum([
    'breakout', 'pullback', 'trend_following', 'reversal',
    'scalping', 'news', 'range', 'other'
  ]).optional(),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W']).optional(),

  // Timing
  entry_at: z.string().min(1, 'Waktu entry wajib diisi'),
  exit_at: z.string().optional(),

  // Pricing
  entry_price: z.coerce.number({ required_error: 'Harga entry wajib diisi' }).positive('Harga harus positif'),
  exit_price: z.coerce.number().positive().optional(),

  // Position sizing
  position_size: z.coerce.number().positive().optional(),
  leverage: z.coerce.number().min(1).max(200).default(1),
  margin_used: z.coerce.number().positive().optional(),

  // Risk
  stop_loss: z.coerce.number().positive().optional(),
  take_profit: z.coerce.number().positive().optional(),
  risk_amount: z.coerce.number().nonnegative().optional(),
  risk_percent: z.coerce.number().min(0).max(100).optional(),
  reward_target: z.coerce.number().nonnegative().optional(),
  rr_ratio: z.coerce.number().nonnegative().optional(),

  // Financial
  fee: z.coerce.number().nonnegative().default(0),
  funding_fee: z.coerce.number().default(0),
  gross_pnl: z.coerce.number().optional(),
  net_pnl: z.coerce.number().optional(),
  result: z.enum(['win', 'loss', 'breakeven']).optional(),

  // Context
  market_condition: z.enum([
    'trending', 'ranging', 'volatile', 'low_volume', 'high_volume'
  ]).optional(),
  entry_reason: z.string().max(1000).optional(),
  exit_reason: z.string().max(1000).optional(),
  mistake_notes: z.string().max(1000).optional(),
  lesson_learned: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
}).refine(data => {
  // If exit_at is set, it must be after entry_at
  if (data.exit_at && data.entry_at) {
    return new Date(data.exit_at) > new Date(data.entry_at);
  }
  return true;
}, { message: 'Waktu exit harus setelah waktu entry', path: ['exit_at'] })
.refine(data => {
  // If mode is bot, bot_name is recommended (not strictly required)
  return true;
}, { path: ['bot_name'] });

export const psychologyFormSchema = z.object({
  emotion_before: z.enum([
    'tenang', 'takut', 'FOMO', 'serakah', 'ragu',
    'revenge_trading', 'percaya_diri_berlebihan', 'percaya_diri'
  ]).optional(),
  emotion_during: z.string().optional(),
  emotion_after: z.string().optional(),
  followed_plan_entry: z.boolean().optional(),
  followed_plan_exit: z.boolean().optional(),
  moved_sl_invalid: z.boolean().default(false),
  moved_tp_emotion: z.boolean().default(false),
  overtraded: z.boolean().default(false),
  revenge_trade: z.boolean().default(false),
  oversized: z.boolean().default(false),
  discipline_score: z.coerce.number().int().min(1).max(10).optional(),
  setup_quality_score: z.coerce.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
});

export const reviewFormSchema = z.object({
  period_type: z.enum(['daily', 'weekly', 'monthly']),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  what_worked: z.string().max(2000).optional(),
  biggest_mistake: z.string().max(2000).optional(),
  main_lesson: z.string().max(2000).optional(),
  strategy_continue: z.string().max(1000).optional(),
  strategy_stop: z.string().max(1000).optional(),
  risk_management_ok: z.boolean().optional(),
  improvement_plan: z.string().max(2000).optional(),
  overall_rating: z.coerce.number().int().min(1).max(10).optional(),
});

export const tradingRulesSchema = z.object({
  max_risk_per_trade_pct: z.coerce.number().min(0.1).max(100).default(2),
  max_trades_per_day: z.coerce.number().int().min(1).max(100).default(3),
  max_daily_loss: z.coerce.number().nonnegative().optional(),
  max_weekly_loss: z.coerce.number().nonnegative().optional(),
  allowed_hours_start: z.string().optional(),
  allowed_hours_end: z.string().optional(),
  allowed_pairs: z.array(z.string()).default([]),
});

export type TradeFormValues = z.infer<typeof tradeFormSchema>;
export type PsychologyFormValues = z.infer<typeof psychologyFormSchema>;
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
export type TradingRulesValues = z.infer<typeof tradingRulesSchema>;
