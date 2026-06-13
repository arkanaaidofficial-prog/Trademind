'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChecklistItem } from '@/types/trade'

const inp = 'w-full rounded-lg border border-[#2a2a3a] bg-[#0f0f19] px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-blue-500'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'
const card = 'rounded-xl border border-[#2a2a3a] bg-[#14141e] p-4 space-y-4'

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
  const [newChecklistNote, setNewChecklistNote] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
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
    const text = newChecklist.trim()
    if (!text) return

    const item: ChecklistItem = {
      id: Date.now().toString(),
      text,
      note: newChecklistNote.trim() || undefined,
      required: true,
    }
    set('entry_checklist', [...(rules.entry_checklist ?? []), item])
    setNewChecklist('')
    setNewChecklistNote('')
  }

  function removeChecklist(id: string) {
    set('entry_checklist', (rules.entry_checklist ?? []).filter(c => c.id !== id))
  }

  function toggleRequired(id: string) {
    set('entry_checklist', (rules.entry_checklist ?? []).map(c => c.id === id ? { ...c, required: !c.required } : c))
  }

  function updateChecklistNote(id: string, note: string) {
    set('entry_checklist', (rules.entry_checklist ?? []).map(c => c.id === id ? { ...c, note } : c))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const pairs = pairsInput.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
    const checklist = (rules.entry_checklist ?? []).map(item => ({
      ...item,
      text: item.text.trim(),
      note: item.note?.trim() || undefined,
    }))
    const payload = {
      user_id: user.id,
      max_risk_per_trade_pct: rules.max_risk_per_trade_pct ?? null,
      max_trades_per_day: rules.max_trades_per_day ?? null,
      max_daily_loss: rules.max_daily_loss ?? null,
      max_weekly_loss: rules.max_weekly_loss ?? null,
      allowed_hours_start: rules.allowed_hours_start ?? null,
      allowed_hours_end: rules.allowed_hours_end ?? null,
      allowed_pairs: pairs,
      entry_checklist: checklist,
      updated_at: new Date().toISOString(),
    }

    const { error } = rules.id
      ? await supabase.from('trading_rules').update(payload).eq('id', rules.id)
      : await supabase.from('trading_rules').insert(payload)

    setSaving(false)
    if (error) { toast.error('Gagal menyimpan: ' + error.message); return }
    set('entry_checklist', checklist)
    toast.success('Trading rules berhasil disimpan!')
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-white font-bold text-lg">Trading Rules</h1>
        <p className="text-gray-400 text-xs mt-0.5">Aturan dan batas risiko trading pribadimu</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <section className={card}>
            <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Batas Risiko</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

            {rules.max_risk_per_trade_pct && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <p className="text-blue-400 text-xs font-medium">Ringkasan Aturan Risiko</p>
                <p className="text-gray-400 text-xs mt-1">
                  Max risk {rules.max_risk_per_trade_pct}% per trade
                  {rules.max_trades_per_day ? ` · Max ${rules.max_trades_per_day} trade/hari` : ''}
                  {rules.max_daily_loss ? ` · Stop jika rugi $${rules.max_daily_loss}/hari` : ''}
                  {rules.max_weekly_loss ? ` · Stop jika rugi $${rules.max_weekly_loss}/minggu` : ''}
                </p>
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Jam Trading</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </section>

          <section className={card}>
            <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Pair yang Diperbolehkan</h2>
            <div>
              <label className={lbl}>Daftar Pair (pisahkan dengan koma)</label>
              <input className={inp} value={pairsInput} onChange={e => setPairsInput(e.target.value)}
                placeholder="BTCUSDT, ETHUSDT, SOLUSDT" />
            </div>
            {pairsInput && (
              <div className="flex flex-wrap gap-2">
                {pairsInput.split(',').map(p => p.trim()).filter(Boolean).map((p, i) => (
                  <span key={i} className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-xs text-blue-300">
                    {p.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 min-w-0">
          <section className={card}>
            <div className="border-b border-[#2a2a3a] pb-3">
              <h2 className="text-gray-200 font-semibold text-sm">Checklist Sebelum Entry</h2>
              <p className="text-gray-500 text-xs mt-1">Tambahkan catatan untuk menjelaskan kapan kondisi dianggap terpenuhi.</p>
            </div>

            {(rules.entry_checklist ?? []).length === 0 ? (
              <p className="text-gray-500 text-xs">Belum ada checklist. Tambah kondisi wajib sebelum kamu entry.</p>
            ) : (
              <div className="space-y-2">
                {(rules.entry_checklist ?? []).map(item => (
                  <div key={item.id} className="rounded-lg border border-[#2a2a3a] bg-[#1a1a2a] px-3 py-3">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="mt-0.5 w-4 h-4 text-gray-600 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-300 text-xs font-medium">{item.text}</p>
                        <textarea
                          rows={2}
                          value={item.note ?? ''}
                          onChange={e => updateChecklistNote(item.id, e.target.value)}
                          placeholder="Catatan opsional, contoh: H1 dan H4 harus searah..."
                          className="mt-2 w-full resize-none rounded-lg border border-[#2a2a3a] bg-[#0f0f19] px-2.5 py-2 text-xs text-gray-300 outline-none placeholder:text-gray-600 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button type="button" onClick={() => toggleRequired(item.id)}
                          className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${
                            item.required ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-[#2a2a3a] text-gray-500'
                          }`}>
                          {item.required ? 'Wajib' : 'Opsional'}
                        </button>
                        <button type="button" onClick={() => removeChecklist(item.id)} className="text-gray-600 hover:text-red-400 transition-colors" aria-label={`Hapus ${item.text}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-[#2a2a3a] bg-[#10101a] p-3">
              <div>
                <label className={lbl}>Nama kondisi</label>
                <input className={inp} value={newChecklist} onChange={e => setNewChecklist(e.target.value)}
                  placeholder="Contoh: Trend HTF konfirmasi arah" />
              </div>
              <div>
                <label className={lbl}>Catatan kondisi <span className="text-gray-600">(opsional)</span></label>
                <textarea
                  rows={2}
                  className={inp + ' resize-none'}
                  value={newChecklistNote}
                  onChange={e => setNewChecklistNote(e.target.value)}
                  placeholder="Contoh: Minimal H1 dan H4 sama-sama bullish"
                />
              </div>
              <button type="button" onClick={addChecklist} disabled={!newChecklist.trim()}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                + Tambah Checklist
              </button>
            </div>
          </section>

          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Trading Rules'}
          </button>
        </aside>
      </div>
    </div>
  )
}
