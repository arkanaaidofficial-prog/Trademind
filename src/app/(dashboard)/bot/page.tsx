'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { BotConfig } from '@/types/trade'
import { Icons } from '@/components/ui/Icons'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-60'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

const EMPTY_FORM = { name:'', version:'', mode:'live', exchange:'', strategy:'', notes:'' }

type BotWithStats = BotConfig & { trade_count: number; net_pnl: number }
type BotTradeStat = { id?: string; net_pnl: number | null }

export default function BotPage() {
  const [bots,     setBots]     = useState<BotWithStats[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const saveLockRef = useRef(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      if (userError) toast.error('Gagal membaca user aktif')
      setBots([])
      setLoading(false)
      return
    }

    const { data: botList, error: botError } = await supabase
      .from('bot_configs').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

    if (botError) {
      toast.error('Gagal memuat bot')
      setBots([])
      setLoading(false)
      return
    }

    if (!botList?.length) {
      setBots([])
      setLoading(false)
      return
    }

    const botsWithStats: BotWithStats[] = await Promise.all(
      (botList ?? []).map(async b => {
        const [{ data: byId }, { data: byName }] = await Promise.all([
          supabase.from('trades').select('id,net_pnl').eq('user_id', user.id).eq('bot_id', b.id),
          supabase.from('trades').select('id,net_pnl').eq('user_id', user.id).eq('bot_name', b.name),
        ])
        const unique = new Map<string, BotTradeStat>()
        ;[...(byId ?? []), ...(byName ?? [])].forEach((trade, index) => {
          unique.set(trade.id ?? `row-${index}`, trade)
        })
        const trades = Array.from(unique.values())
        return {
          ...b,
          trade_count: trades.length,
          net_pnl: parseFloat(trades.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0).toFixed(2)),
        }
      })
    )
    setBots(botsWithStats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (saveLockRef.current) return

    const name = form.name.trim()
    const version = form.version.trim()
    if (!name) { toast.error('Nama bot wajib diisi'); return }

    saveLockRef.current = true
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        toast.error('Gagal membaca user aktif')
        return
      }

      const { data: existing, error: duplicateCheckError } = await supabase
        .from('bot_configs')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', name)
        .eq('version', version)
        .limit(1)

      if (duplicateCheckError) {
        toast.error('Gagal memeriksa data bot')
        return
      }

      if (existing?.length) {
        toast.error(`Bot ${name}${version ? ` ${version}` : ''} sudah terdaftar`)
        return
      }

      const { error } = await supabase.from('bot_configs').insert({
        user_id: user.id,
        ...form,
        name,
        version,
        exchange: form.exchange.trim(),
        strategy: form.strategy.trim(),
        notes: form.notes.trim(),
      })

      if (error) {
        toast.error('Gagal menyimpan bot')
        return
      }

      toast.success('Bot berhasil ditambahkan!')
      setShowForm(false)
      setForm(EMPTY_FORM)
      await load()
    } finally {
      saveLockRef.current = false
      setSaving(false)
    }
  }

  function closeForm() {
    if (saveLockRef.current) return
    setShowForm(false)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat bot...</p></div>

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-lg">Bot Journal</h1>
          <p className="text-gray-400 text-xs mt-0.5">Lacak & bandingkan performa bot trading kamu</p>
        </div>
        <button onClick={() => setShowForm(true)} disabled={saving}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60">
          <Icons.Plus /> Tambah Bot
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a]">
              <h2 className="text-white font-bold">Tambah Bot</h2>
              <button onClick={closeForm} disabled={saving} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#2a2a3a] transition-colors disabled:cursor-not-allowed disabled:opacity-40">
                <Icons.Close />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={lbl}>Nama Bot *</label><input disabled={saving} className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="OMAD SNIPER" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Versi</label><input disabled={saving} className={inp} value={form.version} onChange={e => set('version', e.target.value)} placeholder="v11" /></div>
                <div>
                  <label className={lbl}>Mode</label>
                  <select disabled={saving} className={inp + ' cursor-pointer'} value={form.mode} onChange={e => set('mode', e.target.value)}>
                    <option value="live">Live</option><option value="paper">Paper</option>
                  </select>
                </div>
              </div>
              <div><label className={lbl}>Exchange</label><input disabled={saving} className={inp} value={form.exchange} onChange={e => set('exchange', e.target.value)} placeholder="Binance" /></div>
              <div><label className={lbl}>Strategy</label><input disabled={saving} className={inp} value={form.strategy} onChange={e => set('strategy', e.target.value)} placeholder="TMV Intelligence" /></div>
              <div><label className={lbl}>Catatan</label><textarea disabled={saving} className={inp + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
              <div className="flex gap-3">
                <button onClick={closeForm} disabled={saving} className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50">Batal</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bots.length === 0 ? (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center py-16 gap-3">
          <Icons.EmptyBot />
          <p className="text-gray-400 text-sm">Belum ada bot terdaftar</p>
          <button onClick={() => setShowForm(true)} disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60">
            <Icons.Plus /> Tambah Bot Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bots.map(b => (
            <Link key={b.id} href={`/bot/${b.id}`}
              className="bg-[#14141e] border border-[#2a2a3a] hover:border-blue-500/40 rounded-xl p-5 space-y-3 transition-all group">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-gray-400 group-hover:text-blue-400 transition-colors"><Icons.Bot /></div>
                    <span className="text-white font-bold text-sm group-hover:text-blue-300 transition-colors">{b.name}</span>
                    {b.version && <span className="text-xs bg-[#1e1e2e] text-gray-400 px-2 py-0.5 rounded-lg">{b.version}</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5 ml-6">{b.exchange ?? '-'} · {b.strategy ?? '-'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg font-bold flex-shrink-0 ${b.mode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {b.mode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1e1e2e]">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide">Trades</p>
                  <p className="text-gray-200 text-sm font-bold">{b.trade_count}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide">Net P/L</p>
                  <p className={`text-sm font-bold font-mono ${b.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {b.net_pnl >= 0 ? '+' : ''}${b.net_pnl}
                  </p>
                </div>
              </div>

              {b.notes && <p className="text-gray-500 text-xs">{b.notes}</p>}
              <div className="flex items-center justify-between">
                <p className="text-gray-600 text-xs">{new Date(b.created_at).toLocaleDateString('id-ID')}</p>
                <span className="text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Lihat Detail -&gt;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
