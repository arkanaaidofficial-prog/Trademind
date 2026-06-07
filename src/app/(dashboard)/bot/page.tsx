'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { BotConfig } from '@/types/trade'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

export default function BotPage() {
  const [bots, setBots] = useState<BotConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', version: '', mode: 'live', exchange: '', strategy: '', notes: '' })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('bot_configs').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setBots(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!form.name) { toast.error('Nama bot wajib diisi'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('bot_configs').insert({ user_id: user.id, ...form })
    setSaving(false)
    if (error) { toast.error('Gagal menyimpan bot'); return }
    toast.success('Bot berhasil ditambahkan!')
    setShowForm(false)
    setForm({ name: '', version: '', mode: 'live', exchange: '', strategy: '', notes: '' })
    load()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Bot Journal</h1>
          <p className="text-gray-400 text-xs mt-0.5">Lacak performa bot trading kamu</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">
          + Tambah Bot
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a]">
              <h2 className="text-white font-bold">Tambah Bot</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xl">×</button>
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

      {bots.length === 0 ? (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 15h.01M16 15h.01"/></svg>
          <p className="text-gray-400 text-sm">Belum ada bot terdaftar</p>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">Tambah Bot Pertama</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bots.map(b => (
            <div key={b.id} className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{b.name}</span>
                    {b.version && <span className="text-xs bg-[#1e1e2e] text-gray-400 px-2 py-0.5 rounded-lg">{b.version}</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{b.exchange ?? '—'} · {b.strategy ?? '—'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg font-bold ${b.mode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {b.mode.toUpperCase()}
                </span>
              </div>
              {b.notes && <p className="text-gray-400 text-xs">{b.notes}</p>}
              <p className="text-gray-600 text-xs">{new Date(b.created_at).toLocaleDateString('id-ID')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
