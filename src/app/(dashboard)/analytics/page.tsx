'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import type { Trade } from '@/types/trade'

type Dim = { label: string; trades: number; wins: number; net_pnl: number; win_rate: number }

function groupBy(trades: Trade[], key: keyof Trade): Dim[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const k = String(t[key] ?? 'Unknown')
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return Array.from(map.entries()).map(([label, ts]) => ({
    label,
    trades: ts.length,
    wins: ts.filter(t => t.result === 'win').length,
    net_pnl: Math.round(ts.reduce((s, t) => s + (t.net_pnl ?? 0), 0) * 100) / 100,
    win_rate: Math.round((ts.filter(t => t.result === 'win').length / ts.length) * 100),
  })).sort((a, b) => b.net_pnl - a.net_pnl)
}

function groupByDay(trades: Trade[]): { date: string; pnl: number; trades: number }[] {
  const map = new Map<string, { pnl: number; trades: number }>()
  for (const t of trades) {
    const date = t.entry_at.slice(0, 10)
    const prev = map.get(date) ?? { pnl: 0, trades: 0 }
    map.set(date, { pnl: prev.pnl + (t.net_pnl ?? 0), trades: prev.trades + 1 })
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, pnl: Math.round(v.pnl * 100) / 100, trades: v.trades }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function groupByHour(trades: Trade[]): { hour: string; trades: number; win_rate: number; net_pnl: number }[] {
  const map = new Map<number, Trade[]>()
  for (const t of trades) {
    const h = new Date(t.entry_at).getHours()
    if (!map.has(h)) map.set(h, [])
    map.get(h)!.push(t)
  }
  return Array.from(map.entries())
    .map(([h, ts]) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      trades: ts.length,
      win_rate: Math.round((ts.filter(t => t.result === 'win').length / ts.length) * 100),
      net_pnl: Math.round(ts.reduce((s, t) => s + (t.net_pnl ?? 0), 0) * 100) / 100,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour))
}

const TABS = [
  { key: 'pair', label: 'Per Pair' },
  { key: 'strategy', label: 'Strategi' },
  { key: 'timeframe', label: 'Timeframe' },
  { key: 'condition', label: 'Market Condition' },
  { key: 'emotion', label: 'Emosi' },
  { key: 'day', label: 'Per Hari' },
  { key: 'hour', label: 'Per Jam' },
  { key: 'mode', label: 'Manual vs Bot' },
] as const

type Tab = typeof TABS[number]['key']

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {p.name}: {typeof p.value === 'number' ? (p.name.includes('%') ? `${p.value}%` : `$${p.value}`) : p.value}
        </p>
      ))}
    </div>
  )
}

function DimTable({ data }: { data: Dim[] }) {
  if (!data.length) return <p className="text-gray-500 text-sm text-center py-8">Tidak ada data</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a3a]">
            {['Label', 'Trades', 'Win Rate', 'Net P/L'].map(h => (
              <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e2e]">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
              <td className="px-4 py-3 text-gray-200 text-xs font-medium">{d.label}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
              <td className={`px-4 py-3 text-xs font-bold ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</td>
              <td className={`px-4 py-3 text-xs font-bold font-mono ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pair')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: t } = await supabase.from('trades').select('*').eq('user_id', data.user.id).order('entry_at', { ascending: true })
      setTrades(t ?? [])
      setLoading(false)
    })
  }, [])

  const dimData = useMemo(() => {
    switch (tab) {
      case 'pair': return groupBy(trades, 'symbol')
      case 'strategy': return groupBy(trades, 'strategy_name')
      case 'timeframe': return groupBy(trades, 'timeframe')
      case 'condition': return groupBy(trades, 'market_condition')
      case 'mode': return groupBy(trades, 'mode')
      default: return []
    }
  }, [trades, tab])

  const dayData = useMemo(() => groupByDay(trades), [trades])
  const hourData = useMemo(() => groupByHour(trades), [trades])

  // Equity curve
  const equityCurve = useMemo(() => {
    let eq = 0
    return trades.map(t => { eq += (t.net_pnl ?? 0); return { date: t.entry_at.slice(0, 10), equity: Math.round(eq * 100) / 100 } })
  }, [trades])

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat analytics...</p></div>

  if (!trades.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      <h2 className="text-white font-bold text-xl">Belum ada data</h2>
      <p className="text-gray-400 text-sm text-center">Tambahkan beberapa trade untuk melihat analytics.</p>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white font-bold text-lg">Analytics</h1>
        <p className="text-gray-400 text-xs mt-0.5">{trades.length} trades dianalisis</p>
      </div>

      {/* Equity curve */}
      {equityCurve.length > 1 && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityCurve}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Equity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#0e0e18] border border-[#1e1e2e] rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
        {['pair', 'strategy', 'timeframe', 'condition', 'mode'].includes(tab) && (
          <>
            {dimData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dimData.slice(0, 10)}>
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="net_pnl" name="Net P/L" radius={[4, 4, 0, 0]}>
                      {dimData.slice(0, 10).map((d, i) => (
                        <Cell key={i} fill={d.net_pnl >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a]"><DimTable data={dimData} /></div>
          </>
        )}

        {tab === 'day' && (
          <>
            {dayData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayData}>
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pnl" name="Net P/L" radius={[4, 4, 0, 0]}>
                      {dayData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Tanggal', 'Trades', 'Net P/L'].map(h => <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {dayData.map((d, i) => (
                    <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs">{d.date}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
                      <td className={`px-4 py-3 text-xs font-bold font-mono ${d.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.pnl >= 0 ? '+' : ''}${d.pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'hour' && (
          <>
            {hourData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourData}>
                    <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="win_rate" name="Win Rate%" radius={[4, 4, 0, 0]}>
                      {hourData.map((d, i) => <Cell key={i} fill={d.win_rate >= 50 ? '#3b82f6' : '#6b7280'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Jam', 'Trades', 'Win Rate', 'Net P/L'].map(h => <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {hourData.map((d, i) => (
                    <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs font-mono">{d.hour}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
                      <td className={`px-4 py-3 text-xs font-bold ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</td>
                      <td className={`px-4 py-3 text-xs font-bold font-mono ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'emotion' && (
          <div className="p-4">
            <p className="text-gray-400 text-xs mb-4">Performa berdasarkan emosi sebelum entry (dari Psychology Journal)</p>
            {/* Emotion data comes from trade_psychology - show placeholder if no psych data */}
            <p className="text-gray-500 text-sm text-center py-8">
              Data emosi diambil dari Psychology Journal di setiap trade. Pastikan kamu mengisi emosi saat tambah trade.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
