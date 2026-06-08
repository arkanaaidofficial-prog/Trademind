'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { BotConfig, Trade } from '@/types/trade'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

type BotStats = {
  total_trades: number
  wins: number
  losses: number
  win_rate: number
  net_pnl: number
  total_fee: number
  max_drawdown: number
  best_trade: number
  worst_trade: number
}

function calcBotStats(trades: Trade[]): BotStats {
  if (!trades.length) return { total_trades: 0, wins: 0, losses: 0, win_rate: 0, net_pnl: 0, total_fee: 0, max_drawdown: 0, best_trade: 0, worst_trade: 0 }
  const wins = trades.filter(t => t.result === 'win').length
  const losses = trades.filter(t => t.result === 'loss').length
  const net_pnl = trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const total_fee = trades.reduce((s, t) => s + (t.fee ?? 0) + (t.funding_fee ?? 0), 0)
  const pnls = trades.map(t => t.net_pnl ?? 0)
  const best_trade = Math.max(...pnls)
  const worst_trade = Math.min(...pnls)
  // Max drawdown
  let peak = 0, equity = 0, maxDD = 0
  for (const t of trades) {
    equity += t.net_pnl ?? 0
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDD) maxDD = dd
  }
  return {
    total_trades: trades.length,
    wins, losses,
    win_rate: trades.length ? Math.round((wins / trades.length) * 100) : 0,
    net_pnl: Math.round(net_pnl * 100) / 100,
    total_fee: Math.round(total_fee * 100) / 100,
    max_drawdown: Math.round(maxDD * 100) / 100,
    best_trade, worst_trade,
  }
}

export default function BotPage() {
  const [bots, setBots] = useState<BotConfig[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'compare'>('overview')
  const [form, setForm] = useState({ name: '', version: '', mode: 'live', exchange: '', strategy: '', notes: '' })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: botsData }, { data: tradesData }] = await Promise.all([
      supabase.from('bot_configs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('trades').select('*').eq('user_id', user.id).eq('mode', 'bot').order('entry_at', { ascending: true }),
    ])
    setBots(botsData ?? [])
    setTrades(tradesData ?? [])
    if (botsData && botsData.length > 0 && !selected) setSelected(botsData[0].id)
  }

  useEffect(() => { load() }, [])

  const selectedBot = bots.find(b => b.id === selected)
  const botTrades = useMemo(() =>
    trades.filter(t => selectedBot && (t.bot_name === selectedBot.name)),
    [trades, selectedBot]
  )
  const stats = useMemo(() => calcBotStats(botTrades), [botTrades])

  // Compare all bots
  const compareData = useMemo(() =>
    bots.map(b => {
      const bt = trades.filter(t => t.bot_name === b.name)
      return { bot: b, stats: calcBotStats(bt) }
    }),
    [bots, trades]
  )

  async function handleSave() {
    if (!form.name) { toast.error('Nama bot wajib diisi'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('bot_configs').insert({ user_id: user.id, ...form }).select().single()
    setSaving(false)
    if (error) { toast.error('Gagal menyimpan bot'); return }
    toast.success('Bot berhasil ditambahkan!')
    setShowForm(false)
    setForm({ name: '', version: '', mode: 'live', exchange: '', strategy: '', notes: '' })
    await load()
    if (data) setSelected(data.id)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus bot ini?')) return
    const supabase = createClient()
    await supabase.from('bot_configs').delete().eq('id', id)
    toast.success('Bot dihapus')
    setBots(prev => prev.filter(b => b.id !== id))
    if (selected === id) setSelected(bots.find(b => b.id !== id)?.id ?? null)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Bot Journal</h1>
          <p className="text-gray-400 text-xs mt-0.5">Lacak & bandingkan performa bot trading kamu</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">
          + Tambah Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600">
            <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
            <path d="M12 7v4M8 15h.01M16 15h.01"/>
          </svg>
          <p className="text-gray-400 text-sm">Belum ada bot terdaftar</p>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">
            Tambah Bot Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Bot list sidebar */}
          <div className="space-y-2">
            {bots.map(b => (
              <button key={b.id} onClick={() => setSelected(b.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selected === b.id
                    ? 'bg-blue-600/20 border-blue-600/40'
                    : 'bg-[#14141e] border-[#2a2a3a] hover:border-gray-600'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium truncate">{b.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ml-1 flex-shrink-0 ${
                    b.mode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>{b.mode.toUpperCase()}</span>
                </div>
                {b.version && <p className="text-gray-500 text-xs mt-0.5">{b.version}</p>}
                {b.exchange && <p className="text-gray-600 text-xs">{b.exchange}</p>}
              </button>
            ))}
          </div>

          {/* Bot detail */}
          <div className="lg:col-span-3 space-y-4">
            {selectedBot && (
              <>
                {/* Bot header */}
                <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-white font-bold">{selectedBot.name}</h2>
                      {selectedBot.version && <span className="text-xs bg-[#1e1e2e] text-gray-400 px-2 py-0.5 rounded-lg">{selectedBot.version}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${selectedBot.mode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {selectedBot.mode.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {selectedBot.exchange ?? '—'} · {selectedBot.strategy ?? '—'}
                    </p>
                    {selectedBot.notes && <p className="text-gray-400 text-xs mt-1">{selectedBot.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(selectedBot.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs">Hapus</button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-[#0e0e18] border border-[#1e1e2e] rounded-xl p-1">
                  {(['overview', 'trades', 'compare'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all capitalize ${
                        activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}>
                      {tab === 'overview' ? 'Performa' : tab === 'trades' ? 'History Trade' : 'Bandingkan'}
                    </button>
                  ))}
                </div>

                {/* Overview tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Trades', value: stats.total_trades, color: '' },
                        { label: 'Win Rate', value: `${stats.win_rate}%`, color: stats.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400' },
                        { label: 'Net P/L', value: `${stats.net_pnl >= 0 ? '+' : ''}$${stats.net_pnl}`, color: stats.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                        { label: 'Total Fee', value: `$${stats.total_fee}`, color: 'text-yellow-400' },
                      ].map(m => (
                        <div key={m.label} className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 text-center">
                          <p className={`text-xl font-bold font-mono ${m.color || 'text-white'}`}>{m.value}</p>
                          <p className="text-gray-500 text-xs mt-1">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Win', value: stats.wins, color: 'text-emerald-400' },
                        { label: 'Loss', value: stats.losses, color: 'text-red-400' },
                        { label: 'Best Trade', value: `+$${stats.best_trade}`, color: 'text-emerald-400' },
                        { label: 'Worst Trade', value: `-$${Math.abs(stats.worst_trade)}`, color: 'text-red-400' },
                        { label: 'Max Drawdown', value: `$${stats.max_drawdown}`, color: 'text-red-400' },
                      ].map(m => (
                        <div key={m.label} className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 flex justify-between items-center">
                          <span className="text-gray-400 text-xs">{m.label}</span>
                          <span className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</span>
                        </div>
                      ))}
                    </div>

                    {botTrades.length === 0 && (
                      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-8 text-center">
                        <p className="text-gray-500 text-sm">Belum ada trade dengan nama bot "{selectedBot.name}"</p>
                        <p className="text-gray-600 text-xs mt-1">Tambah trade dengan mode Bot dan nama yang sama</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Trades tab */}
                {activeTab === 'trades' && (
                  <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
                    {botTrades.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-gray-500 text-sm">Belum ada history trade untuk bot ini</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#2a2a3a]">
                              {['Tanggal', 'Pair', 'Side', 'Entry', 'Exit', 'Net P/L', 'Hasil'].map(h => (
                                <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e1e2e]">
                            {botTrades.map(t => (
                              <tr key={t.id} className="hover:bg-[#1a1a2a] transition-colors">
                                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                  {new Date(t.entry_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="px-4 py-3 text-gray-100 text-xs font-medium">{t.symbol}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold ${t.position_type === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {t.position_type?.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-300 font-mono text-xs">{Number(t.entry_price).toLocaleString()}</td>
                                <td className="px-4 py-3 text-gray-300 font-mono text-xs">{t.exit_price ? Number(t.exit_price).toLocaleString() : '—'}</td>
                                <td className={`px-4 py-3 font-bold font-mono text-sm ${(t.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {(t.net_pnl ?? 0) >= 0 ? '+' : ''}${t.net_pnl ?? 0}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    t.result === 'win' ? 'bg-emerald-500/20 text-emerald-400'
                                    : t.result === 'loss' ? 'bg-red-500/20 text-red-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                  }`}>{t.result?.toUpperCase() ?? '—'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Compare tab */}
                {activeTab === 'compare' && (
                  <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#2a2a3a]">
                      <p className="text-gray-300 text-sm font-semibold">Perbandingan Semua Bot</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#2a2a3a]">
                            {['Bot', 'Mode', 'Trades', 'Win Rate', 'Net P/L', 'Max DD', 'Fee'].map(h => (
                              <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e1e2e]">
                          {compareData.map(({ bot, stats: s }) => (
                            <tr key={bot.id}
                              className={`hover:bg-[#1a1a2a] transition-colors cursor-pointer ${bot.id === selected ? 'bg-blue-600/10' : ''}`}
                              onClick={() => setSelected(bot.id)}>
                              <td className="px-4 py-3">
                                <p className="text-gray-200 text-xs font-medium">{bot.name}</p>
                                {bot.version && <p className="text-gray-600 text-[10px]">{bot.version}</p>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-bold ${bot.mode === 'live' ? 'text-emerald-400' : 'text-gray-400'}`}>
                                  {bot.mode.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-300 text-xs">{s.total_trades}</td>
                              <td className={`px-4 py-3 text-xs font-bold ${s.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {s.win_rate}%
                              </td>
                              <td className={`px-4 py-3 text-xs font-bold font-mono ${s.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {s.net_pnl >= 0 ? '+' : ''}${s.net_pnl}
                              </td>
                              <td className="px-4 py-3 text-red-400 text-xs font-mono">${s.max_drawdown}</td>
                              <td className="px-4 py-3 text-yellow-400 text-xs font-mono">${s.total_fee}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Bot Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a]">
              <h2 className="text-white font-bold">Tambah Bot</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={lbl}>Nama Bot *</label><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="OMAD SNIPER" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Versi</label><input className={inp} value={form.version} onChange={e => set('version', e.target.value)} placeholder="v11" /></div>
                <div>
                  <label className={lbl}>Mode</label>
                  <select className={inp + ' cursor-pointer'} value={form.mode} onChange={e => set('mode', e.target.value)}>
                    <option value="live">Live</option><option value="paper">Paper</option>
                  </select>
                </div>
              </div>
              <div><label className={lbl}>Exchange</label><input className={inp} value={form.exchange} onChange={e => set('exchange', e.target.value)} placeholder="Binance" /></div>
              <div><label className={lbl}>Strategy</label><input className={inp} value={form.strategy} onChange={e => set('strategy', e.target.value)} placeholder="TMV Intelligence" /></div>
              <div><label className={lbl}>Catatan</label><textarea className={inp + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors">Batal</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
