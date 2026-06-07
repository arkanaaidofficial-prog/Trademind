'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Review } from '@/types/trade'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'
const ta = inp + ' resize-none'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    period_type: 'weekly' as Review['period_type'],
    period_start: new Date().toISOString().slice(0,10),
    period_end: new Date().toISOString().slice(0,10),
    what_worked: '',
    biggest_mistake: '',
    main_lesson: '',
    strategy_continue: '',
    strategy_stop: '',
    risk_management_ok: true,
    improvement_plan: '',
    overall_rating: 7,
  })

  function set(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })) }

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('reviews').select('*').eq('user_id', user.id).order('period_start', { ascending: false })
    setReviews(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('reviews').upsert({
      user_id: user.id,
      ...form,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,period_type,period_start' })
    setSaving(false)
    if (error) { toast.error('Gagal menyimpan review'); return }
    toast.success('Review berhasil disimpan!')
    setShowForm(false)
    load()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Reviews</h1>
          <p className="text-gray-400 text-xs mt-0.5">Refleksi harian, mingguan & bulanan</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">
          + Buat Review
        </button>
      </div>

      {/* Review Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a] sticky top-0 bg-[#14141e]">
              <h2 className="text-white font-bold">Buat Review</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(['daily','weekly','monthly'] as const).map(p => (
                  <button key={p} type="button" onClick={() => set('period_type', p)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${form.period_type === p ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'border-[#2a2a3a] text-gray-500'}`}>
                    {p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulanan'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Dari</label><input type="date" className={inp} value={form.period_start} onChange={e => set('period_start', e.target.value)} /></div>
                <div><label className={lbl}>Sampai</label><input type="date" className={inp} value={form.period_end} onChange={e => set('period_end', e.target.value)} /></div>
              </div>
              <div><label className={lbl}>Apa yang berjalan baik?</label><textarea className={ta} rows={2} value={form.what_worked} onChange={e => set('what_worked', e.target.value)} /></div>
              <div><label className={lbl}>Kesalahan terbesar?</label><textarea className={ta} rows={2} value={form.biggest_mistake} onChange={e => set('biggest_mistake', e.target.value)} /></div>
              <div><label className={lbl}>Pelajaran utama?</label><textarea className={ta} rows={2} value={form.main_lesson} onChange={e => set('main_lesson', e.target.value)} /></div>
              <div><label className={lbl}>▶ Strategi yang dilanjutkan?</label><textarea className={ta} rows={1} value={form.strategy_continue} onChange={e => set('strategy_continue', e.target.value)} /></div>
              <div><label className={lbl}>■ Strategi yang dihentikan?</label><textarea className={ta} rows={1} value={form.strategy_stop} onChange={e => set('strategy_stop', e.target.value)} /></div>
              <div><label className={lbl}>Rencana perbaikan?</label><textarea className={ta} rows={2} value={form.improvement_plan} onChange={e => set('improvement_plan', e.target.value)} /></div>
              <div className="flex items-center gap-3">
                <label className="text-gray-400 text-xs">Risk management dipatuhi?</label>
                <input type="checkbox" className="accent-blue-500 w-4 h-4" checked={form.risk_management_ok} onChange={e => set('risk_management_ok', e.target.checked)} />
              </div>
              <div>
                <label className={lbl}>Rating Keseluruhan: <span className="text-blue-400 font-bold">{form.overall_rating}/10</span></label>
                <input type="range" min={1} max={10} className="w-full accent-blue-500" value={form.overall_rating} onChange={e => set('overall_rating', +e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors">Batal</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review List */}
      {reviews.length === 0 ? (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <p className="text-gray-400 text-sm">Belum ada review</p>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">Buat Review Pertama</button>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-lg font-bold border ${
                    r.period_type === 'daily' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : r.period_type === 'weekly' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>{r.period_type}</span>
                  <span className="text-gray-300 text-sm font-medium">{r.period_start} — {r.period_end}</span>
                </div>
                {r.overall_rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 text-xs font-bold">{r.overall_rating}/10</span>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400 inline"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {r.what_worked && <div><p className="text-gray-500 text-xs mb-1">Yang Berhasil</p><p className="text-gray-300 text-sm">{r.what_worked}</p></div>}
                {r.biggest_mistake && <div><p className="text-gray-500 text-xs mb-1">— Kesalahan Terbesar</p><p className="text-red-300 text-sm">{r.biggest_mistake}</p></div>}
                {r.main_lesson && <div><p className="text-gray-500 text-xs mb-1">Pelajaran</p><p className="text-emerald-300 text-sm">{r.main_lesson}</p></div>}
                {r.improvement_plan && <div><p className="text-gray-500 text-xs mb-1">Rencana</p><p className="text-gray-300 text-sm">{r.improvement_plan}</p></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
