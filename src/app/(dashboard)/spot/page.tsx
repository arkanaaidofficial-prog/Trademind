'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { calculateSpotHoldings, calculateSpotPortfolioStats } from '@/lib/calculations/spot'
import type { Trade } from '@/types/trade'
import { Icons } from '@/components/ui/Icons'

const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

function money(value: number) {
  return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function signedMoney(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${money(Math.abs(value))}`
}

function quantity(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })
}

function StatCard({ label, value, sub, tone = 'default' }: {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'green' | 'red' | 'blue' | 'gold'
}) {
  const style = {
    default: 'border-[#2a2a3a] bg-[#14141e] text-white',
    green: 'border-emerald-900/40 bg-emerald-950/30 text-emerald-400',
    red: 'border-red-900/40 bg-red-950/30 text-red-400',
    blue: 'border-blue-900/40 bg-blue-950/30 text-blue-400',
    gold: 'border-amber-900/40 bg-amber-950/30 text-amber-400',
  }[tone]

  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-xl font-bold font-mono">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-blue-400">{p.name}: {money(p.value)}</p>
      ))}
    </div>
  )
}

export default function SpotPortfolioPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_at', { ascending: true })

      if (error) {
        toast.error('Gagal memuat portfolio spot')
        setLoading(false)
        return
      }

      setTrades(data ?? [])
      setLoading(false)
    }

    load()
  }, [])

  const holdings = useMemo(() => calculateSpotHoldings(trades), [trades])
  const openHoldings = useMemo(() => holdings.filter(holding => holding.quantity > 0), [holdings])
  const stats = useMemo(() => calculateSpotPortfolioStats(trades), [trades])
  const spotTrades = useMemo(() => trades
    .filter(trade => (trade.trade_account_type ?? 'spot') === 'spot')
    .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime()), [trades])

  const chartData = openHoldings.map(holding => ({
    symbol: holding.symbol,
    value: holding.estimated_value,
  }))

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat portfolio spot...</p></div>

  if (!spotTrades.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <Icons.EmptyTrades />
      <h1 className="text-white font-bold text-xl">Belum ada spot trade</h1>
      <p className="text-gray-400 text-sm text-center max-w-xs">Catat pembelian spot pertama untuk mulai melihat holdings.</p>
      <Link href="/trades/new" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">Tambah Spot Trade</Link>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-lg">Spot Portfolio</h1>
          <p className="text-gray-400 text-xs mt-0.5">{stats.holdings_count} holdings aktif - {stats.spot_trades} spot trades</p>
        </div>
        <Link href="/trades/new" className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">+ Add Spot Trade</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Estimated Value" value={money(stats.estimated_value)} sub={`Cost: ${money(stats.total_cost_basis)}`} tone="blue" />
        <StatCard label="Unrealized P/L" value={signedMoney(stats.unrealized_pnl)} tone={stats.unrealized_pnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Realized P/L" value={signedMoney(stats.realized_pnl)} sub={`${stats.buy_trades} buy / ${stats.sell_trades} sell`} tone={stats.realized_pnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Total Fees" value={money(stats.total_fees)} sub={`${stats.holdings_count} open holdings`} tone="gold" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
            <h2 className="text-gray-300 text-sm font-semibold">Holdings</h2>
            <span className="text-gray-500 text-xs">Last trade price</span>
          </div>
          {openHoldings.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Tidak ada posisi spot terbuka</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a3a]">
                    {['Asset','Qty','Avg Cost','Last Price','Cost','Est. Value','Unrealized','Realized'].map(h => (
                      <th key={h} className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {openHoldings.map(holding => (
                    <tr key={holding.symbol} className="hover:bg-[#1a1a2a] transition-colors">
                      <td className="px-4 py-3 text-gray-100 font-bold whitespace-nowrap">{holding.symbol}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{quantity(holding.quantity)}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{money(holding.avg_cost)}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{money(holding.latest_price)}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{money(holding.cost_basis)}</td>
                      <td className="px-4 py-3 text-gray-200 font-mono text-xs font-bold whitespace-nowrap">{money(holding.estimated_value)}</td>
                      <td className={`px-4 py-3 font-mono text-xs font-bold whitespace-nowrap ${holding.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {signedMoney(holding.unrealized_pnl)}
                      </td>
                      <td className={`px-4 py-3 font-mono text-xs font-bold whitespace-nowrap ${holding.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {signedMoney(holding.realized_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h2 className="text-gray-300 text-sm font-semibold mb-4">Allocation</h2>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="symbol" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">Tidak ada holdings aktif</div>
          )}
        </div>
      </div>

      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
          <h2 className="text-gray-300 text-sm font-semibold">Spot Trades Terakhir</h2>
          <Link href="/trades" className="text-blue-400 text-xs hover:text-blue-300">Lihat Semua</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a3a]">
                {['Tanggal','Asset','Side','Qty','Price','Fee','Net P/L'].map(h => (
                  <th key={h} className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {spotTrades.slice(0, 8).map(trade => (
                <tr key={trade.id} className="hover:bg-[#1a1a2a] transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(trade.entry_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-4 py-3 text-gray-100 font-medium whitespace-nowrap"><Link href={`/trades/${trade.id}`} className="hover:text-blue-400">{trade.symbol}</Link></td>
                  <td className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${trade.position_type === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>{trade.position_type === 'long' ? 'BUY' : 'SELL'}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{quantity(Number(trade.position_size ?? 0))}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{money(Number(trade.entry_price ?? 0))}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{money(Number(trade.fee ?? 0))}</td>
                  <td className={`px-4 py-3 font-mono text-xs font-bold whitespace-nowrap ${(trade.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{signedMoney(Number(trade.net_pnl ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
