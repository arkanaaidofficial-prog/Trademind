'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { PENDING_WATCHLIST_ENTRY_KEY, parsePendingWatchlistEntry } from '@/lib/watchlist/pending'
import type { PendingWatchlistEntry } from '@/lib/watchlist/pending'

const MAX_PENDING_AGE_MS = 60 * 60 * 1000

function getTradeId(pathname: string) {
  const match = /^\/trades\/([^/]+)$/.exec(pathname)
  return match?.[1] ?? null
}

export default function PendingWatchlistMarker() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const tradeId = getTradeId(pathname)
    if (!tradeId) return

    const pending = parsePendingWatchlistEntry(window.sessionStorage.getItem(PENDING_WATCHLIST_ENTRY_KEY))
    if (!pending) return

    if (Date.now() - pending.createdAt > MAX_PENDING_AGE_MS) {
      window.sessionStorage.removeItem(PENDING_WATCHLIST_ENTRY_KEY)
      return
    }

    let active = true

    // `pending` diterima sebagai ARGUMEN, bukan ditangkap dari lingkup
    // luar. Deklarasi fungsi di-hoist, jadi TypeScript tidak bisa
    // memastikan penjagaan `if (!pending) return` di atas sudah berjalan
    // saat badan fungsi ini dijalankan — dan memang secara tipe ia benar.
    async function markEntered(entri: PendingWatchlistEntry) {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!active || userError || !user) return

      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('id,symbol,user_id')
        .eq('id', tradeId)
        .eq('user_id', user.id)
        .single()

      if (!active || tradeError || !trade?.symbol) return
      if (String(trade.symbol).toUpperCase() !== entri.symbol) return

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('coin_watchlist')
        .update({ watch_status: 'entered', last_reviewed_at: now, updated_at: now })
        .eq('id', entri.id)
        .eq('user_id', user.id)

      if (!active) return

      if (error) {
        toast.warning('Trade tersimpan, tetapi status watchlist belum berubah')
        return
      }

      window.sessionStorage.removeItem(PENDING_WATCHLIST_ENTRY_KEY)
      toast.success('Watchlist ditandai Entered')
    }

    markEntered(pending)

    return () => {
      active = false
    }
  }, [pathname])

  return null
}
