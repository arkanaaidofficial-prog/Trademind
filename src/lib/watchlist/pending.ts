export const PENDING_WATCHLIST_ENTRY_KEY = 'trademind:pending-watchlist-entry'

export type PendingWatchlistEntry = {
  id: string
  symbol: string
  createdAt: number
}

export function serializePendingWatchlistEntry(entry: PendingWatchlistEntry) {
  return JSON.stringify(entry)
}

export function parsePendingWatchlistEntry(raw: string | null): PendingWatchlistEntry | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PendingWatchlistEntry>
    if (!parsed.id || !parsed.symbol || !Number.isFinite(parsed.createdAt)) return null

    return {
      id: parsed.id,
      symbol: parsed.symbol.toUpperCase(),
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}
