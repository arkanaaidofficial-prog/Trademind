'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

const DEFAULT_CHECKLIST = [
  'Trend dikonfirmasi di TF lebih tinggi',
  'Setup sesuai strategi terdokumentasi',
  'Risk tidak melebihi batas per trade',
  'SL sudah ditentukan sebelum entry',
  'Tidak dalam kondisi revenge trade',
  'Tidak overtrade (cek jumlah trade hari ini)',
]

export default function RulesPage() {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [rules, setRules] = useState({
    max_risk_per_trade_pct: 2,
    max_trades_per_day: 3,
    max_daily_loss: '',
    max_weekly_loss: '',
    allowed_hours_start: '09:00',
    allowed_hours_end: '22:00',
    allowed_pairs: '',
    entry_checklist: DEFAULT_CHECKLIST,
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('trading_rules').select('*').eq('user_id', user.id).single()
      if (data) {
        setRules({
          max_risk_per_trade_pct: data.max_risk_per_trade_pct ?? 2,
          max_trades_per_day: data.max_trades_per_day ?? 3,
          max_daily_loss: data.max_daily_loss ?? '',
          max_weekly_loss: data.max_weekly_loss ?? '',
          allowed_hours_start: data.allowed_hours_start ?? '09:00',
          allowed_hours_end: data.allowed_hours_end ?? '22:00',
          allowed_pairs: (data.allowed_pairs ?? []).join(', '),
          entry_checklist: data.entry_checklist ?? DEFAULT_CHECKLIST,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('trading_rules').upsert({
      user_id: user.id,
      max_risk_per_trade_pct: Number(rules.max_risk_per_trade_pct),
      max_trades_per_day: Number(rules.max_trades_per_day),
      max_daily_loss: rules.max_daily_loss ? Number(rules.max_daily_loss) : null,
      max_weekly_loss: rules.max_weekly_loss ? Number(rules.max_weekly_loss) : null,
      allowed_hours_start: rules.allowed_hours_start || null,
      allowed_hours_end: rules.allowed_hours_end || null,
      allowed_pairs: rules.allowed_pairs ? rules.allowed_pairs.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [],
      entry_checklist: rules.entry_checklist,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaving(false)
    if (error) { toast.error('Gagal menyimpan: ' + error.message); return }
    toast.success('Trading rules berhasil disimpan!')
  }

  function addChecklist() {
    if (!newItem.trim()) return
    setRules(r => ({ ...r, entry_checklist: [...r.entry_checklist, newItem.trim()] }))
    setNewItem('')
  }

  function removeChecklist(i: number) {
    setRules(r => ({ ...r, entry_checklist: r.entry_checklist.filter((_, idx) => idx !== i) }))
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-white font-bold text-lg">Trading Rules</h1>
        <p className="text-gray-400 text-xs mt-0.5">Aturan trading pribadi & sistem disiplin kamu</p>
      </div>

      {/* Risk Management */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Risk Management</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Max Risk per Trade (%)</label>
            <input type="number" step="0.1" min="0.1" max="100" className={inp}
              value={rules.max_risk_per_trade_pct} onChange={e => setRules(r => ({ ...r, max_risk_per_trade_pct: +e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Max Trade per Hari</label>
            <input type="number" min="1" className={inp}
              value={rules.max_trades_per_day} onChange={e => setRules(r => ({ ...r, max_trades_per_day: +e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Max Kerugian Harian ($)</label>
            <input type="number" className={inp} placeholder="Kosongkan jika tidak ada"
              value={rules.max_daily_loss} onChange={e => setRules(r => ({ ...r, max_daily_loss: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Max Kerugian Mingguan ($)</label>
            <input type="number" className={inp} placeholder="Kosongkan jika tidak ada"
              value={rules.max_weekly_loss} onChange={e => setRules(r => ({ ...r, max_weekly_loss: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Jam Trading Mulai</label>
            <input type="time" className={inp} value={rules.allowed_hours_start} onChange={e => setRules(r => ({ ...r, allowed_hours_start: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Jam Trading Selesai</label>
            <input type="time" className={inp} value={rules.allowed_hours_end} onChange={e => setRules(r => ({ ...r, allowed_hours_end: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className={lbl}>Pair yang Diizinkan (pisahkan dengan koma)</label>
          <input className={inp} placeholder="BTCUSDT, ETHUSDT, SOLUSDT"
            value={rules.allowed_pairs} onChange={e => setRules(r => ({ ...r, allowed_pairs: e.target.value }))} />
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-3">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Pre-Entry Checklist Wajib</h2>
        <div className="space-y-2">
          {rules.entry_checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-[#1a1a2a] rounded-xl group">
              <div className="w-5 h-5 rounded border border-blue-500/50 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 text-xs">✓</span>
              </div>
              <span className="text-gray-300 text-sm flex-1">{item}</span>
              <button onClick={() => removeChecklist(i)} className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={inp} placeholder="Tambah aturan baru..." value={newItem} onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addChecklist()} />
          <button onClick={addChecklist} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl text-sm font-bold transition-colors flex-shrink-0">+</button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors">
        {saving ? 'Menyimpan...' : '💾 Simpan Trading Rules'}
      </button>
    </div>
  )
}
