export type WatchMarketType = 'crypto' | 'forex' | 'saham' | 'futures' | 'other'
export type WatchSourceType = 'telegram' | 'whatsapp' | 'twitter' | 'youtube' | 'news' | 'manual' | 'other'
export type WatchStatus = 'watching' | 'planned' | 'entered' | 'skipped' | 'archived'
export type WatchPriority = 'low' | 'medium' | 'high'

export interface CoinWatchlistItem {
  id: string
  user_id: string
  symbol: string
  market_type: WatchMarketType
  source_type: WatchSourceType
  source_name: string | null
  source_url: string | null
  watch_status: WatchStatus
  priority: WatchPriority
  conviction_score: number
  current_price: number | null
  planned_entry: number | null
  target_price: number | null
  stop_loss: number | null
  thesis: string | null
  risk_notes: string | null
  tags: string[] | null
  added_at: string
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

export const WATCH_SOURCE_LABELS: Record<WatchSourceType, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter/X',
  youtube: 'YouTube',
  news: 'News',
  manual: 'Manual',
  other: 'Other',
}

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  watching: 'Watching',
  planned: 'Planned',
  entered: 'Entered',
  skipped: 'Skipped',
  archived: 'Archived',
}

export const WATCH_PRIORITY_LABELS: Record<WatchPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
