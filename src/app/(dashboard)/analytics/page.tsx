'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcPerformanceByDimension } from '@/lib/calculations/stats'
import type { Trade } from '@/types/trade'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'

const CS = { background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('trades').select('*, psychology:trade_psychology(*)').eq('user_id', user.id)
      setTrades(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const byPair = useMemo(() => calcPerformanceByDimension(trades, t => t.symbol), [trades])
  const byStrategy = useMemo(() => calcPerformanceByDimension(trades, t => t.strategy_name ?? 'Unknown'), [trades])
  const byTimeframe = useMemo(() => calcPerformanceByDimension(trades, t => t.timeframe ?? 'Unknown'), [trades])
  const byMode = useMemo(() => calcPerformanceByDimension(trades, t => t.mode), [trades])

  const emotionData = useMemo(() => {
    const map: Record<string, { name: string; wins: number; losses: number }> = {}
    trades.forEach(t => {
      const psych = (t as any).psychology
      const emo = psych?.emotion_before ?? 'unknown'
      if (!map[emo]) map[emo] = { name: emo, wins: 0, losses: 0 }
      if (t.result === 'win') map[emo].wins++
      if (t.result === 'loss') map[emo].losses++
    })
    return Object.values(map)
  }, [trades])

  const disciplineData = useMemo(() => {
    return trades
      .filter(t => (t as any).psychology?.discipline_score)
      .map(t => ({
        symbol: t.symbol,
        discipline: (t as any).psychology.discipline_score,
        pnl: t.net_pnl ?? 0,
      }))
  }, [trades])

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat analytics...</p></div>

  if (trades.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <h2 className="text-white font-bold text-xl">Belum ada data</h2>
      <p className="text-gray-400 text-sm text-center">Tambahkan beberapa trade untuk melihat analytics.</p>
    </div>
  )

  function PerfTable({ title, data }: { title: string; data: ReturnType<typeof calcPerformanceByDimension> }) {
    return (
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl">
        <div className="px-4 py-3 border-b border-[#2a2a3a]">
          <h3 className="text-gray-300 text-sm font-semibold">{title}</h3>
        </div>
        <div className="divide-y divide-[#1e1e2e]">
          {data.slice(0, 8).map(d => (
            <div key={d.label} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm font-medium truncate">{d.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{d.total} trades · {d.win_rate}% WR</p>
              </div>
              <div className="w-20 bg-[#1e1e2e] rounded-full h-1.5 flex-shrink-0">
                <div className={`rounded-full h-1.5 ${d.net_pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(d.net_pnl) / Math.max(...data.map(x => Math.abs(x.net_pnl))) * 100)}%` }} />
              </div>
              <span className={`font-mono text-sm font-bold flex-shrink-0 w-20 text-right ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-white font-bold text-lg">Analytics</h1>
        <p className="text-gray-400 text-xs mt-0.5">Analisis mendalam performa trading kamu</p>
      </div>

      {/* By Pair chart */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
        <h3 className="text-gray-300 text-sm font-semibold mb-4">P/L per Pair</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byPair.slice(0,10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" horizontal={false} />
            <XAxis type="number" stroke="#4b5563" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <YAxis type="category" dataKey="label" stroke="#4b5563" tick={{ fontSize: 11 }} width={70} />
            <Tooltip contentStyle={CS} />
            <Bar dataKey="net_pnl" name="Net P/L" radius={[0, 4, 4, 0]}>
              {byPair.slice(0,10).map((d, i) => <Cell key={i} fill={d.net_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerfTable title="Performa per Strategi" data={byStrategy} />
        <PerfTable title="Performa per Timeframe" data={byTimeframe} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerfTable title="Manual vs Bot" data={byMode} />

        {/* Emotion chart */}
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Emosi vs Hasil</h3>
          {emotionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={emotionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="name" stroke="#4b5563" tick={{ fontSize: 9 }} />
                <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={CS} />
                <Bar dataKey="wins" name="Wins" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="losses" name="Losses" fill="#ef4444" radius={[4,4,0,0]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-xs text-center py-8">Belum ada data psikologi</p>}
        </div>
      </div>

      {/* Discipline correlation */}
      {disciplineData.length > 0 && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Korelasi Disiplin vs P/L</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={disciplineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="symbol" stroke="#4b5563" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#3b82f6" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={CS} />
              <Line yAxisId="left" type="monotone" dataKey="discipline" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Disiplin" />
              <Line yAxisId="right" type="monotone" dataKey="pnl" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="P/L" />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
