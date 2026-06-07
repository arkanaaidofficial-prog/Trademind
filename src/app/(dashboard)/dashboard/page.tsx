'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcDashboardStats, buildEquityCurve } from '@/lib/calculations/stats'
import type { Trade } from '@/types/trade'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import Link from 'next/link'

function StatCard({ label, value, sub, color = 'default', icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string
}) {
  const border: Record<string, string> = {
    default: 'border-[#2a2a3a] bg-[#14141e]',
    green: 'border-emerald-900/40 bg-emerald-950/30',
    red: 'border-red-900/40 bg-red-950/30',
    blue: 'border-blue-900/40 bg-blue-950/30',
    gold: 'border-amber-900/40 bg-amber-950/30',
  }
  const text: Record<string, string> = {
    default: 'text-white', green: 'text-emerald-400',
    red: 'text-red-400', blue: 'text-blue-400', gold: 'text-amber-400'
  }
  return (
    <div className={`rounded-xl border p-4 ${border[color]}`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-xl font-bold font-mono ${text[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function Badge({ result }: { result?: string }) {
  if (result === 'win') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">WIN</span>
  if (result === 'loss') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">LOSS</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">BE</span>
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_at', { ascending: true })
      setTrades(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => calcDashboardStats(trades), [trades])
  const equityCurve = useMemo(() => buildEquityCurve(trades), [trades])

  const dailyPnl = useMemo(() => {
    const map: Record<string, number> = {}
    trades.forEach(t => {
      const day = t.entry_at?.slice(0, 10) ?? ''
      map[day] = (map[day] ?? 0) + (t.net_pnl ?? 0)
    })
    return Object.entries(map).slice(-14).map(([date, pnl]) => ({
      day: new Date(date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
      pnl: parseFloat(pnl.toFixed(2))
    }))
  }, [trades])

  const winLoss = [
    { name: 'Wins', value: stats.winning_trades },
    { name: 'Losses', value: stats.losing_trades },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-sm animate-pulse">Memuat data...</div>
    </div>
  )

  if (trades.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <p className="text-5xl">📊</p>
      <h2 className="text-white font-bold text-xl">Belum ada trade</h2>
      <p className="text-gray-400 text-sm text-center max-w-xs">Mulai dengan menambahkan trade pertama kamu untuk melihat dashboard performa.</p>
      <Link href="/trades/new" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">+ Tambah Trade Pertama</Link>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Dashboard</h1>
          <p className="text-gray-400 text-xs mt-0.5">{trades.length} trades tercatat</p>
        </div>
        <Link href="/trades/new" className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">+ Add Trade</Link>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Net P/L" value={`${stats.net_pnl >= 0 ? '+' : ''}$${stats.net_pnl}`} sub={`Gross: $${stats.gross_pnl}`} color={stats.net_pnl >= 0 ? 'green' : 'red'} icon="💰" />
        <StatCard label="Win Rate" value={`${stats.win_rate}%`} sub={`${stats.winning_trades}W / ${stats.losing_trades}L`} color="blue" icon="🎯" />
        <StatCard label="Profit Factor" value={stats.profit_factor === Infinity ? '∞' : stats.profit_factor} sub={`Expectancy: $${stats.expectancy}`} color="gold" icon="⚡" />
        <StatCard label="Total Trades" value={stats.total_trades} sub={`Fee: $${stats.total_fee}`} icon="📊" />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Avg Win" value={`+$${stats.avg_win}`} color="green" icon="📈" />
        <StatCard label="Avg Loss" value={`-$${stats.avg_loss}`} color="red" icon="📉" />
        <StatCard label="Best Trade" value={`+$${stats.best_trade_pnl}`} sub={stats.best_pair} color="green" icon="🏆" />
        <StatCard label="Max Drawdown" value={`-$${stats.max_drawdown}`} color="red" icon="📉" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 10 }} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} tickFormatter={v => `$${v.toLocaleString()}`} />
              <Tooltip contentStyle={{ background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h3 className="text-gray-300 text-sm font-semibold mb-2">Win / Loss</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={winLoss} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                <Cell fill="#10b981" /><Cell fill="#ef4444" />
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily P/L */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
        <h3 className="text-gray-300 text-sm font-semibold mb-4">Daily P/L (14 hari terakhir)</h3>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={dailyPnl}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="day" stroke="#4b5563" tick={{ fontSize: 10 }} />
            <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {dailyPnl.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Trades */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a]">
          <h3 className="text-gray-300 text-sm font-semibold">Trade Terakhir</h3>
          <Link href="/trades" className="text-blue-400 text-xs hover:text-blue-300">Lihat Semua →</Link>
        </div>
        <div className="divide-y divide-[#1e1e2e]">
          {[...trades].reverse().slice(0, 5).map(t => (
            <Link key={t.id} href={`/trades/${t.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[#1a1a2a] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                {t.symbol?.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-200 text-sm font-medium">{t.symbol}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.position_type === 'long' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {t.position_type?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 bg-[#1e1e2e] px-1.5 py-0.5 rounded">{t.mode}</span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">{t.strategy_name ?? '—'} · {t.timeframe ?? '—'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold font-mono ${(t.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(t.net_pnl ?? 0) >= 0 ? '+' : ''}{t.net_pnl ?? 0}
                </p>
                <Badge result={t.result} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
