'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { tradesToCsv, downloadFile } from '@/lib/importExport'
import type { Trade, TradeFilter } from '@/types/trade'
import { toast } from 'sonner'

function Badge({ result }: { result?: string }) {
  if (result === 'win') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">WIN</span>
  if (result === 'loss') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">LOSS</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">BE</span>
}

const sel = 'bg-[#1a1a2a] border border-[#2a2a3a] text-gray-300 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer'
const inp = 'bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500'

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TradeFilter>({ result: 'all', mode: 'all', symbol: '' })
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_at', { ascending: false })
    if (error) { toast.error('Gagal memuat trades'); return }
    setTrades(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => trades.filter(t => {
    if (filter.result && filter.result !== 'all' && t.result !== filter.result) return false
    if (filter.mode && filter.mode !== 'all' && t.mode !== filter.mode) return false
    if (filter.symbol && !t.symbol?.toLowerCase().includes(filter.symbol.toLowerCase())) return false
    return true
  }), [trades, filter])

  async function handleDelete(id: string) {
    if (!confirm('Hapus trade ini?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (error) { toast.error('Gagal menghapus trade'); setDeleting(null); return }
    toast.success('Trade dihapus')
    setTrades(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
  }

  function handleExport() {
    const csv = tradesToCsv(filtered as Trade[])
    downloadFile(csv, `trademind-export-${new Date().toISOString().slice(0,10)}.csv`)
    toast.success(`${filtered.length} trades berhasil diekspor`)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat trades...</p></div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-lg">Trade Journal</h1>
          <p className="text-gray-400 text-xs mt-0.5">{filtered.length} dari {trades.length} trades</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExport} className="border border-[#2a2a3a] hover:border-gray-500 text-gray-300 hover:text-white text-xs px-3 py-2 rounded-lg transition-colors">
            ↓ Export CSV
          </button>
          <Link href="/trades/import" className="border border-[#2a2a3a] hover:border-gray-500 text-gray-300 hover:text-white text-xs px-3 py-2 rounded-lg transition-colors">
            ↑ Import CSV
          </Link>
          <Link href="/trades/new" className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">
            + Add Trade
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input value={filter.symbol ?? ''} onChange={e => setFilter(f => ({ ...f, symbol: e.target.value }))}
            placeholder="Cari pair..." className={inp + ' w-36'} />
          <select value={filter.result ?? 'all'} onChange={e => setFilter(f => ({ ...f, result: e.target.value as TradeFilter['result'] }))} className={sel}>
            <option value="all">Semua Hasil</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="breakeven">Breakeven</option>
          </select>
          <select value={filter.mode ?? 'all'} onChange={e => setFilter(f => ({ ...f, mode: e.target.value as TradeFilter['mode'] }))} className={sel}>
            <option value="all">Semua Mode</option>
            <option value="manual">Manual</option>
            <option value="bot">Bot</option>
            <option value="copytrade">Copytrade</option>
            <option value="signal">Signal</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <p className="text-gray-400 text-sm">Belum ada trade yang cocok</p>
          <Link href="/trades/new" className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">+ Add Trade</Link>
        </div>
      ) : (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3a]">
                  {['Tanggal','Pair','Side','Mode','Strategy','TF','Entry','Exit','P/L (Net)','Fee','Hasil','Aksi'].map(h => (
                    <th key={h} className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-[#1a1a2a] transition-colors group">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(t.entry_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })}
                    </td>
                    <td className="px-4 py-3 text-gray-100 font-medium whitespace-nowrap">
                      <Link href={`/trades/${t.id}`} className="hover:text-blue-400 transition-colors">{t.symbol}</Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-bold ${t.position_type === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.position_type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{t.mode}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap max-w-[120px] truncate">{t.strategy_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{t.timeframe ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{Number(t.entry_price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{t.exit_price ? Number(t.exit_price).toLocaleString() : '—'}</td>
                    <td className={`px-4 py-3 font-bold font-mono text-sm whitespace-nowrap ${(t.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(t.net_pnl ?? 0) >= 0 ? '+' : ''}{t.net_pnl ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{t.fee ?? 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge result={t.result} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/trades/${t.id}/edit`} className="text-gray-400 hover:text-blue-400 text-xs transition-colors">Edit</Link>
                        <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                          className="text-gray-400 hover:text-red-400 text-xs transition-colors disabled:opacity-40">
                          {deleting === t.id ? '...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
