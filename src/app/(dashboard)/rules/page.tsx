'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

type ChecklistItem = { id: string; text: string; required: boolean }

type Rules = {
  id?: string
  max_risk_per_trade_pct?: number
  max_trades_per_day?: number
  max_daily_loss?: number
  max_weekly_loss?: number
  allowed_hours_start?: string
  allowed_hours_end?: string
  allowed_pairs?: string[]
  entry_checklist?: ChecklistItem[]
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rules>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pairsInput, setPairsInput] = useState('')
  const [newChecklist, setNewChecklist] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: r } = await supabase.from('trading_rules').select('*').eq('user_id', data.user.id).single()
      if (r) {
        setRules(r)
        setPairsInput((r.allowed_pairs ?? []).join(', '))
      }
      setLoading(false)
    })
  }, [])

  function set(k: string, v: unknown) { setRules(r => ({ ...r, [k]: v })) }

  function addChecklist() {
    if (!newChecklist.trim()) return
    const item: ChecklistItem = { id: Date.now().toString(), text: newChecklist.trim(), required: true }
    set('entry_checklist', [...(rules.entry_checklist ?? []), item])
    setNewChecklist('')
  }

  function removeChecklist(id: string) {
    set('entry_checklist', (rules.entry_checklist ?? []).filter(c => c.id !== id))
  }

  function toggleRequired(id: string) {
    set('entry_checklist', (rules.entry_checklist ?? []).map(c => c.id === id ? { ...c, required: !c.required } : c))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const pairs = pairsInput.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
    const payload = {
      user_id: user.id,
      max_risk_per_trade_pct: rules.max_risk_per_trade_pct ?? null,
      max_trades_per_day: rules.max_trades_per_day ?? null,
      max_daily_loss: rules.max_daily_loss ?? null,
      max_weekly_loss: rules.max_weekly_loss ?? null,
      allowed_hours_start: rules.allowed_hours_start ?? null,
      allowed_hours_end: rules.allowed_hours_end ?? null,
      allowed_pairs: pairs,
      entry_checklist: rules.entry_checklist ?? [],
      updated_at: new Date().toISOString(),
    }

    const { error } = rules.id
      ? await supabase.from('trading_rules').update(payload).eq('id', rules.id)
      : await supabase.from('trading_rules').insert(payload)

    setSaving(false)
    if (error) { toast.error('Gagal menyimpan: ' + error.message); return }
    toast.success('Trading rules berhasil disimpan!')
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-white font-bold text-xl">Trading Rules</h1>
        <p className="text-gray-500 text-xs mt-1">Aturan dan batas risiko trading pribadimu</p>
      </div>

      {/* Risk limits */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Batas Risiko</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Max Risk per Trade (%)</label>
            <input type="number" step="0.1" min="0" max="100" className={inp}
              value={rules.max_risk_per_trade_pct ?? ''} onChange={e => set('max_risk_per_trade_pct', +e.target.value)}
              placeholder="2" />
          </div>
          <div>
            <label className={lbl}>Max Trade per Hari</label>
            <input type="number" min="0" className={inp}
              value={rules.max_trades_per_day ?? ''} onChange={e => set('max_trades_per_day', +e.target.value)}
              placeholder="3" />
          </div>
          <div>
            <label className={lbl}>Max Loss Harian ($)</label>
            <input type="number" step="any" min="0" className={inp}
              value={rules.max_daily_loss ?? ''} onChange={e => set('max_daily_loss', +e.target.value)}
              placeholder="100" />
          </div>
          <div>
            <label className={lbl}>Max Loss Mingguan ($)</label>
            <input type="number" step="any" min="0" className={inp}
              value={rules.max_weekly_loss ?? ''} onChange={e => set('max_weekly_loss', +e.target.value)}
              placeholder="300" />
          </div>
        </div>

        {/* Risk info card */}
        {rules.max_risk_per_trade_pct && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-400 text-xs font-medium">Ringkasan Aturan Risiko</p>
            <p className="text-gray-400 text-xs mt-1">
              Max risk {rules.max_risk_per_trade_pct}% per trade
              {rules.max_trades_per_day ? ` · Max ${rules.max_trades_per_day} trade/hari` : ''}
              {rules.max_daily_loss ? ` · Stop jika rugi $${rules.max_daily_loss}/hari` : ''}
              {rules.max_weekly_loss ? ` · Stop jika rugi $${rules.max_weekly_loss}/minggu` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Trading hours */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Jam Trading</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Mulai (WIB)</label>
            <input type="time" className={inp}
              value={rules.allowed_hours_start ?? ''} onChange={e => set('allowed_hours_start', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Selesai (WIB)</label>
            <input type="time" className={inp}
              value={rules.allowed_hours_end ?? ''} onChange={e => set('allowed_hours_end', e.target.value)} />
          </div>
        </div>
        {rules.allowed_hours_start && rules.allowed_hours_end && (
          <p className="text-gray-500 text-xs">Trading hanya diperbolehkan {rules.allowed_hours_start} — {rules.allowed_hours_end} WIB</p>
        )}
      </div>

      {/* Allowed pairs */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Pair yang Diperbolehkan</h2>
        <div>
          <label className={lbl}>Daftar Pair (pisahkan dengan koma)</label>
          <input className={inp} value={pairsInput} onChange={e => setPairsInput(e.target.value)}
            placeholder="BTCUSDT, ETHUSDT, SOLUSDT" />
        </div>
        {pairsInput && (
          <div className="flex flex-wrap gap-2">
            {pairsInput.split(',').map(p => p.trim()).filter(Boolean).map((p, i) => (
              <span key={i} className="bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs px-2 py-1 rounded-lg">
                {p.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Entry checklist */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Checklist Sebelum Entry</h2>

        {(rules.entry_checklist ?? []).length === 0 ? (
          <p className="text-gray-500 text-xs">Belum ada checklist. Tambah kondisi wajib sebelum kamu entry.</p>
        ) : (
          <div className="space-y-2">
            {(rules.entry_checklist ?? []).map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-[#1a1a2a] border border-[#2a2a3a] rounded-xl px-3 py-2.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-gray-600 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-gray-300 text-xs flex-1">{item.text}</span>
                <button onClick={() => toggleRequired(item.id)}
                  className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${
                    item.required ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-[#2a2a3a] text-gray-500'
                  }`}>
                  {item.required ? 'Wajib' : 'Opsional'}
                </button>
                <button onClick={() => removeChecklist(item.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input className={inp} value={newChecklist} onChange={e => setNewChecklist(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addChecklist()}
            placeholder="Contoh: Trend HTF konfirmasi arah..." />
          <button onClick={addChecklist}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition-colors whitespace-nowrap">
            + Tambah
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors">
        {saving ? 'Menyimpan...' : 'Simpan Trading Rules'}
      </button>
    </div>
  )
}
