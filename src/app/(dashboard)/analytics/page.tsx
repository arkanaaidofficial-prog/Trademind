'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import type { Trade } from '@/types/trade'

type Psych = {
  trade_id: string
  emotion_before: string | null
  discipline_score: number | null
  setup_quality_score: number | null
  followed_plan_entry: boolean | null
  followed_plan_exit: boolean | null
  revenge_trade: boolean | null
  oversized: boolean | null
}

type Dim = { label: string; trades: number; wins: number; net_pnl: number; win_rate: number }
type HourDim = { hour: string; trades: number; win_rate: number; net_pnl: number }

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

function groupByDay(trades: Trade[]) {
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

function groupByHour(trades: Trade[]): HourDim[] {
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

const CT = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {p.name}: {p.name.includes('%') ? `${p.value}%` : `$${p.value}`}
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

const TABS = [
  { key: 'pair', label: 'Per Pair' },
  { key: 'strategy', label: 'Strategi' },
  { key: 'timeframe', label: 'Timeframe' },
  { key: 'condition', label: 'Kondisi Pasar' },
  { key: 'emotion', label: 'Emosi' },
  { key: 'day', label: 'Per Hari' },
  { key: 'hour', label: 'Per Jam' },
  { key: 'mode', label: 'Manual vs Bot' },
] as const
type Tab = typeof TABS[number]['key']

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [psychData, setPsychData] = useState<Psych[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pair')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', data.user.id).order('entry_at', { ascending: true }),
        supabase.from('trade_psychology').select('*').eq('user_id', data.user.id),
      ])
      setTrades(t ?? [])
      setPsychData(p ?? [])
      setLoading(false)
    })
  }, [])

  const dimData = useMemo(() => {
    if (['pair','strategy','timeframe','condition','mode'].includes(tab)) {
      const keyMap: Record<string, keyof Trade> = {
        pair: 'symbol', strategy: 'strategy_name',
        timeframe: 'timeframe', condition: 'market_condition', mode: 'mode',
      }
      return groupBy(trades, keyMap[tab])
    }
    return []
  }, [trades, tab])

  const dayData = useMemo(() => groupByDay(trades), [trades])
  const hourData = useMemo(() => groupByHour(trades), [trades])

  // Emotion analytics - join trades + psychology
  const emotionData = useMemo(() => {
    if (tab !== 'emotion') return []
    const psychMap = new Map(psychData.map(p => [p.trade_id, p]))
    const byEmotion = new Map<string, { trades: Trade[]; discipline: number[] }>()
    for (const t of trades) {
      const p = psychMap.get(t.id)
      if (!p?.emotion_before) continue
      const e = p.emotion_before
      if (!byEmotion.has(e)) byEmotion.set(e, { trades: [], discipline: [] })
      byEmotion.get(e)!.trades.push(t)
      if (p.discipline_score) byEmotion.get(e)!.discipline.push(p.discipline_score)
    }
    return Array.from(byEmotion.entries()).map(([emotion, v]) => {
      const wins = v.trades.filter(t => t.result === 'win').length
      const net_pnl = Math.round(v.trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0) * 100) / 100
      const avg_discipline = v.discipline.length
        ? Math.round(v.discipline.reduce((s, d) => s + d, 0) / v.discipline.length * 10) / 10
        : null
      return {
        label: emotion,
        trades: v.trades.length,
        wins,
        net_pnl,
        win_rate: Math.round((wins / v.trades.length) * 100),
        avg_discipline,
      }
    }).sort((a, b) => b.net_pnl - a.net_pnl)
  }, [trades, psychData, tab])

  // Discipline vs PnL correlation
  const disciplineCorr = useMemo(() => {
    if (tab !== 'emotion') return []
    return psychData
      .map(p => {
        const t = trades.find(t => t.id === p.trade_id)
        if (!t || p.discipline_score === null) return null
        return { discipline: p.discipline_score, pnl: t.net_pnl ?? 0, symbol: t.symbol }
      })
      .filter(Boolean) as { discipline: number; pnl: number; symbol: string }[]
  }, [trades, psychData, tab])

  const equityCurve = useMemo(() => {
    let eq = 0
    return trades.map(t => {
      eq += (t.net_pnl ?? 0)
      return { date: t.entry_at.slice(0, 10), equity: Math.round(eq * 100) / 100 }
    })
  }, [trades])

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat analytics...</p></div>

  if (!trades.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      <h2 className="text-white font-bold text-xl">Belum ada data</h2>
      <p className="text-gray-400 text-sm">Tambahkan beberapa trade untuk melihat analytics.</p>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white font-bold text-lg">Analytics</h1>
        <p className="text-gray-400 text-xs mt-0.5">{trades.length} trades · {psychData.length} psychology records</p>
      </div>

      {/* Equity curve */}
      {equityCurve.length > 1 && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityCurve}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CT />} />
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

      {/* Tab Content */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">

        {/* Dimension tabs */}
        {['pair','strategy','timeframe','condition','mode'].includes(tab) && (
          <>
            {dimData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dimData.slice(0, 10)}>
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="net_pnl" name="Net P/L" radius={[4,4,0,0]}>
                      {dimData.slice(0,10).map((d, i) => <Cell key={i} fill={d.net_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a]"><DimTable data={dimData} /></div>
          </>
        )}

        {/* Day tab */}
        {tab === 'day' && (
          <>
            {dayData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayData}>
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="pnl" name="Net P/L" radius={[4,4,0,0]}>
                      {dayData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Tanggal','Trades','Net P/L'].map(h => <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>)}
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

        {/* Hour tab */}
        {tab === 'hour' && (
          <>
            {hourData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourData}>
                    <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="win_rate" name="Win Rate%" radius={[4,4,0,0]}>
                      {hourData.map((d, i) => <Cell key={i} fill={d.win_rate >= 50 ? '#3b82f6' : '#6b7280'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Jam','Trades','Win Rate','Net P/L'].map(h => <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>)}
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

        {/* Emotion tab */}
        {tab === 'emotion' && (
          <div className="space-y-0">
            {!psychData.length ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">Belum ada data psychology.</p>
                <p className="text-gray-500 text-xs mt-1">Isi emosi di setiap trade untuk melihat korelasi emosi dan performa.</p>
              </div>
            ) : (
              <>
                {emotionData.length > 0 && (
                  <div className="p-4">
                    <p className="text-gray-400 text-xs mb-3">Net P/L berdasarkan emosi sebelum entry</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={emotionData}>
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<CT />} />
                        <Bar dataKey="net_pnl" name="Net P/L" radius={[4,4,0,0]}>
                          {emotionData.map((d, i) => <Cell key={i} fill={d.net_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="border-t border-[#2a2a3a] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#2a2a3a]">
                      {['Emosi','Trades','Win Rate','Net P/L','Avg Disiplin'].map(h => (
                        <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-[#1e1e2e]">
                      {emotionData.map((d, i) => (
                        <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
                          <td className="px-4 py-3 text-gray-200 text-xs font-medium capitalize">{d.label}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</td>
                          <td className={`px-4 py-3 text-xs font-bold font-mono ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl}
                          </td>
                          <td className="px-4 py-3 text-xs text-blue-400 font-medium">
                            {d.avg_discipline ? `${d.avg_discipline}/10` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Discipline correlation */}
                {disciplineCorr.length > 0 && (
                  <div className="border-t border-[#2a2a3a] p-4">
                    <p className="text-gray-400 text-xs mb-3">Korelasi Skor Disiplin vs P/L</p>
                    <div className="grid grid-cols-5 gap-1">
                      {[1,2,3,4,5,6,7,8,9,10].map(score => {
                        const group = disciplineCorr.filter(d => d.discipline === score)
                        const avg = group.length ? group.reduce((s, d) => s + d.pnl, 0) / group.length : null
                        return (
                          <div key={score} className="text-center">
                            <div className={`h-12 rounded-lg flex items-end justify-center pb-1 text-xs font-bold ${
                              avg === null ? 'bg-[#1a1a2a]' : avg >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                            }`}>
                              {avg !== null ? (
                                <span className={avg >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {avg >= 0 ? '+' : ''}{Math.round(avg)}
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </div>
                            <p className="text-gray-500 text-[10px] mt-1">D{score}</p>
                            <p className="text-gray-600 text-[9px]">{group.length}x</p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-gray-600 text-xs mt-2">D1-D10 = Skor Disiplin. Angka = rata-rata P/L per trade</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
