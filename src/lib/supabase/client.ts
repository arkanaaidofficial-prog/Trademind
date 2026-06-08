// src/lib/supabase/client.ts
// Supabase browser client

import { createBrowserClient } from '@supabase/ssr';
import { TRADE_SCREENSHOTS_BUCKET } from './storage';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── TRADE QUERIES ────────────────────────────────────────────

export async function fetchTrades(userId: string, filters?: {
  result?: string;
  mode?: string;
  symbol?: string;
  date_from?: string;
  date_to?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from('trades')
    .select(`
      *,
      psychology:trade_psychology(*),
      screenshots:trade_screenshots(*)
    `)
    .eq('user_id', userId)
    .order('entry_at', { ascending: false });

  if (filters?.result && filters.result !== 'all') {
    query = query.eq('result', filters.result);
  }
  if (filters?.mode && filters.mode !== 'all') {
    query = query.eq('mode', filters.mode);
  }
  if (filters?.symbol) {
    query = query.ilike('symbol', `%${filters.symbol}%`);
  }
  if (filters?.date_from) {
    query = query.gte('entry_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('entry_at', filters.date_to + 'T23:59:59');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function insertTrade(trade: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('trades')
    .insert(trade)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrade(id: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('trades')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) throw error;
}

// ─── PSYCHOLOGY ───────────────────────────────────────────────

export async function upsertPsychology(data: Record<string, unknown>) {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from('trade_psychology')
    .upsert(data, { onConflict: 'trade_id' })
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ─── SCREENSHOTS ──────────────────────────────────────────────

export async function uploadScreenshot(
  userId: string,
  tradeId: string,
  stage: string,
  file: File
) {
  const supabase = createClient();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/${tradeId}/${stage}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(TRADE_SCREENSHOTS_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from('trade_screenshots').insert({
    trade_id: tradeId,
    user_id: userId,
    stage,
    storage_path: path,
  });
  if (dbError) throw dbError;

  return path;
}

export async function getScreenshotUrl(path: string, expiresIn = 60 * 60) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(TRADE_SCREENSHOTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Failed to create screenshot signed URL');
  }

  return data.signedUrl;
}

// ─── TRADING RULES ────────────────────────────────────────────

export async function fetchTradingRules(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('trading_rules')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function upsertTradingRules(rules: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('trading_rules')
    .upsert(rules, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── REVIEWS ──────────────────────────────────────────────────

export async function fetchReviews(userId: string, periodType?: string) {
  const supabase = createClient();
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .order('period_start', { ascending: false });

  if (periodType) query = query.eq('period_type', periodType);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function upsertReview(review: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reviews')
    .upsert(review, { onConflict: 'user_id,period_type,period_start' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── BOT CONFIGS ──────────────────────────────────────────────

export async function fetchBotConfigs(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bot_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
