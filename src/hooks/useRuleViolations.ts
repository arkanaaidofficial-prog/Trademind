'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Violation = {
  rule: string
  message: string
  severity: 'error' | 'warning'
}

type TradeInput = {
  symbol?: string
  risk_percent?: number | string
  entry_at?: string
  mode?: string
}

type Rules = {
  max_risk_per_trade_pct?: number
  max_trades_per_day?: number
  max_daily_loss?: number
  allowed_pairs?: string[]
  allowed_hours_start?: string
  allowed_hours_end?: string
}

export function useRuleViolations(trade: TradeInput) {
  const [rules, setRules]           = useState<Rules | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [todayPnl, setTodayPnl]     = useState(0)

  // Load trading rules once
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: r } = await supabase
        .from('trading_rules').select('*').eq('user_id', data.user.id).single()
      setRules(r)

      // Today's trade count + pnl
      const today = new Date().toISOString().slice(0, 10)
      const { data: todayTrades } = await supabase
        .from('trades')
        .select('net_pnl')
        .eq('user_id', data.user.id)
        .gte('entry_at', today + 'T00:00:00')
      setTodayCount(todayTrades?.length ?? 0)
      setTodayPnl(todayTrades?.reduce((s, t) => s + (t.net_pnl ?? 0), 0) ?? 0)
    })
  }, [])

  // Re-evaluate violations when trade input or rules change
  useEffect(() => {
    if (!rules) return
    const v: Violation[] = []

    // 1. Pair not allowed
    if (rules.allowed_pairs?.length && trade.symbol) {
      const sym = trade.symbol.toUpperCase()
      if (!rules.allowed_pairs.map(p => p.toUpperCase()).includes(sym)) {
        v.push({ rule: 'pair_not_allowed', severity: 'warning',
          message: `${sym} bukan pair yang diizinkan di rules kamu` })
      }
    }

    // 2. Risk too high
    if (rules.max_risk_per_trade_pct && trade.risk_percent) {
      const rp = Number(trade.risk_percent)
      if (rp > rules.max_risk_per_trade_pct) {
        v.push({ rule: 'risk_exceeded', severity: 'error',
          message: `Risk ${rp}% melebihi batas ${rules.max_risk_per_trade_pct}% per trade` })
      }
    }

    // 3. Outside trading hours
    if (rules.allowed_hours_start && rules.allowed_hours_end && trade.entry_at) {
      const t = new Date(trade.entry_at).toTimeString().slice(0, 5)
      if (t < rules.allowed_hours_start || t > rules.allowed_hours_end) {
        v.push({ rule: 'outside_hours', severity: 'warning',
          message: `Entry jam ${t} di luar jam trading ${rules.allowed_hours_start}–${rules.allowed_hours_end}` })
      }
    }

    // 4. Too many trades today
    if (rules.max_trades_per_day && todayCount >= rules.max_trades_per_day) {
      v.push({ rule: 'max_trades_reached', severity: 'error',
        message: `Sudah ${todayCount} trade hari ini, batas maksimal ${rules.max_trades_per_day}` })
    }

    // 5. Daily loss limit
    if (rules.max_daily_loss && todayPnl < 0 && Math.abs(todayPnl) >= rules.max_daily_loss) {
      v.push({ rule: 'daily_loss_limit', severity: 'error',
        message: `Kerugian hari ini $${Math.abs(todayPnl).toFixed(2)} mencapai batas $${rules.max_daily_loss}` })
    }

    setViolations(v)
  }, [rules, trade.symbol, trade.risk_percent, trade.entry_at, todayCount, todayPnl])

  return { violations, todayCount, todayPnl, hasRules: !!rules }
}
