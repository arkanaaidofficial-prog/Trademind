'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { periksaPelanggaran, ringkasHarian, tanggalHariIni } from '@/lib/rules'
import type { AturanDagang } from '@/lib/rules'
import { zonaWaktuBawaan } from '@/lib/calculations/analytics'
import type { Trade } from '@/types/trade'

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

export function useRuleViolations(trade: TradeInput) {
  const [rules, setRules]           = useState<AturanDagang | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [todayPnl, setTodayPnl]     = useState(0)
  const [zona, setZona]             = useState<string>(() => zonaWaktuBawaan(null))

  // Muat aturan + ringkasan hari berjalan satu kali.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return

      const [{ data: r }, { data: prof }] = await Promise.all([
        supabase.from('trading_rules').select('*').eq('user_id', data.user.id).maybeSingle(),
        supabase.from('profiles').select('timezone').eq('id', data.user.id).maybeSingle(),
      ])
      const zonaPakai = zonaWaktuBawaan(prof?.timezone)
      setZona(zonaPakai)
      setRules(r)

      // Diambil dua hari ke belakang lalu disaring di zona pemilik jurnal.
      // Memotong di batas UTC membuat trade dini hari WIB hilang dari
      // hitungan "hari ini".
      const batas = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data: baris } = await supabase
        .from('trades')
        .select('id,mode,entry_at,exit_at,result,net_pnl')
        .eq('user_id', data.user.id)
        .gte('entry_at', batas)

      const ringkas = ringkasHarian(
        (baris ?? []) as unknown as Trade[],
        zonaPakai,
        tanggalHariIni(zonaPakai),
      )
      setTodayCount(ringkas.trade_hari_ini)
      setTodayPnl(ringkas.pnl_hari_ini)
    })
  }, [])

  // Nilai ulang setiap masukan atau aturan berubah.
  useEffect(() => {
    if (!rules) return
    const hasil = periksaPelanggaran(
      {
        symbol: trade.symbol,
        risk_percent: trade.risk_percent === undefined ? undefined : Number(trade.risk_percent),
        entry_at: trade.entry_at,
        mode: trade.mode as Trade['mode'] | undefined,
      },
      rules,
      zona,
      { trade_hari_ini: todayCount, pnl_hari_ini: todayPnl },
    )
    setViolations(hasil.map(p => ({ rule: p.aturan, message: p.pesan, severity: p.tingkat })))
  }, [rules, zona, trade.symbol, trade.risk_percent, trade.entry_at, trade.mode, todayCount, todayPnl])

  return { violations, todayCount, todayPnl, hasRules: !!rules }
}
