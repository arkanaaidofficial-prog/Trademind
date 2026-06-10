'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TradeForm from '@/components/trades/TradeForm'
import type { MarketType, Trade, TradeMode } from '@/types/trade'
import type { TradeAccountType } from '@/types/trade-account'

const MARKET_TYPES: MarketType[] = ['crypto', 'forex', 'saham', 'futures', 'other']
const TRADE_MODES: TradeMode[] = ['manual', 'bot', 'copytrade', 'signal']
const ACCOUNT_TYPES: TradeAccountType[] = ['spot', 'futures', 'margin']

function pick<T extends string>(value: string | null, allowed: T[], fallback: T) {
  return value && allowed.includes(value as T) ? value as T : fallback
}

function numberParam(params: URLSearchParams, key: string) {
  const value = params.get(key)
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readPrefillFromLocation(): Partial<Trade> | undefined {
  if (typeof window === 'undefined') return undefined

  const params = new URLSearchParams(window.location.search)
  const hasPrefill = ['symbol', 'entry_price', 'take_profit', 'stop_loss', 'entry_reason'].some(key => params.has(key))
  if (!hasPrefill) return undefined

  return {
    symbol: params.get('symbol')?.toUpperCase() ?? '',
    market_type: pick(params.get('market_type'), MARKET_TYPES, 'crypto'),
    trade_account_type: pick(params.get('trade_account_type'), ACCOUNT_TYPES, 'spot'),
    mode: pick(params.get('mode'), TRADE_MODES, 'signal'),
    position_type: 'long',
    entry_price: numberParam(params, 'entry_price'),
    take_profit: numberParam(params, 'take_profit'),
    stop_loss: numberParam(params, 'stop_loss'),
    entry_reason: params.get('entry_reason') ?? undefined,
  }
}

export default function NewTradePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Partial<Trade> | undefined>()
  const [prefillReady, setPrefillReady] = useState(false)

  useEffect(() => {
    setPrefill(readPrefillFromLocation())
    setPrefillReady(true)
  }, [])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  if (!userId || !prefillReady) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>

  return (
    <div>
      <div className="px-6 py-4 border-b border-[#1e1e2e] bg-[#0e0e18] flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-white font-bold">Tambah Trade Baru</h1>
        {prefill && <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-1">Prefill dari watchlist</span>}
      </div>
      <TradeForm trade={prefill} userId={userId} mode="add" />
    </div>
  )
}
