'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Review, Trade, DashboardStats } from '@/types/trade'
import { calcDashboardStats } from '@/lib/calculations/stats'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'
const ta = inp + ' resize-none'

const PERIOD_LABELS: Record<string, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' }
const PERIOD_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  monthly: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

function createDefaultReviewForm() {
  const today = new Date().toISOString().slice(0, 10)
  return {
    period_type: 'weekly' as Review['period_type'],
    period_start: today,
    period_end: today,
    what_worked: '',
    biggest_mistake: '',
    main_lesson: '',
    strategy_continue: '',
    strategy_stop: '',
    risk_management_ok: true,
    improvement_plan: '',
    overall_rating: 7,
  }
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <svg key={i} viewBox="0 0 24 24" fill={i <= Math.round(rating/2) ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 ${i <= Math.round(rating/2) ? 'text-amber-400' : 'text-gray-600'}`}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span className="text-amber-400 text-xs font-bold ml-1">{rating}/10</span>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
      <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
    </div>
  )
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterPeriod, setFilterPeriod] = useState<string>('all')
  const [form, setForm] = useState(createDefaultReviewForm)
  const saveLockRef = useRef(false)

  function setF(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })) }

  function handlePeriodChange(p: Review['period_type']) {
    setF('period_type', p)
    const now = new Date()
    if (p === 'daily') {
      const d = now.toISOString().slice(0, 10)
      setF('period_start', d); setF('period_end', d)
    } else if (p === 'weekly') {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      setF('period_start', mon.toISOString().slice(0, 10))
      setF('period_end', sun.toISOString().slice(0, 10))
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setF('period_start', start.toISOString().slice(0, 10))
      setF('period_end', end.toISOString().slice(0, 10))
    }
  }

  async function load() {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      if (userError) toast.error('Gagal membaca user aktif')
      return
    }
    const [{ data: rv, error: reviewError }, { data: tr, error: tradeError }] = await Promise.all([
      supabase.from('reviews').select('*').eq('user_id', user.id).order('period_start', { ascending: false }),
      supabase.from('trades').select('*').eq('user_id', user.id),
    ])
    if (reviewError) toast.error('Gagal memuat review')
    if (tradeError) toast.error('Gagal memuat data trade')
    setReviews(rv ?? [])
    setTrades(tr ?? [])
  }

  useEffect(() => { load() }, [])

  function getTradesForPeriod(start: string, end: string): Trade[] {
    return trades.filter(t => {
      const d = t.entry_at.slice(0, 10)
      return d >= start && d <= end
    })
  }

  async function handleSave() {
    if (saveLockRef.current) return
    if (!form.period_start || !form.period_end) { toast.error('Isi periode terlebih dahulu'); return }
    if (form.period_end < form.period_start) { toast.error('Tanggal akhir tidak boleh sebelum tanggal mulai'); return }

    saveLockRef.current = true
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        toast.error('Gagal membaca user aktif')
        return
      }

      const periodTrades = getTradesForPeriod(form.period_start, form.period_end)
      const stats = calcDashboardStats(periodTrades)
      const payload = {
        user_id: user.id,
        ...form,
        stats_snapshot: stats as unknown as DashboardStats,
        updated_at: new Date().toISOString(),
      }

      const { data: savedReview, error } = await supabase
        .from('reviews')
        .upsert(payload, { onConflict: 'user_id,period_type,period_start' })
        .select('*')
        .single()

      if (error || !savedReview) {
        toast.error('Gagal menyimpan review: ' + (error?.message ?? 'Data tidak dikembalikan'))
        return
      }

      setReviews(current => {
        const next = current.filter(review =>
          review.id !== savedReview.id &&
          !(review.period_type === savedReview.period_type && review.period_start === savedReview.period_start)
        )
        return [savedReview as Review, ...next].sort((a, b) => b.period_start.localeCompare(a.period_start))
      })
      toast.success('Review berhasil disimpan!')
      setShowForm(false)
      setForm(createDefaultReviewForm())
    } finally {
      saveLockRef.current = false
      setSaving(false)
    }
  }

  function closeForm() {
    if (saveLockRef.current) return
    setShowForm(false)
  }

  const filtered = useMemo(() =>
    filterPeriod === 'all' ? reviews : reviews.filter(r => r.period_type === filterPeriod),
    [reviews, filterPeriod]
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-lg">Reviews</h1>
          <p className="text-gray-400 text-xs mt-0.5">Refleksi dan evaluasi performa trading</p>
        </div>
        <button onClick={() => setShowForm(true)} disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60">
          + Buat Review
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'daily', 'weekly', 'monthly'].map(p => (
          <button key={p} onClick={() => setFilterPeriod(p)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
              filterPeriod === p ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#2a2a3a] text-gray-400 hover:text-gray-200'
            }`}>
            {p === 'all' ? 'Semua' : PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a] sticky top-0 bg-[#14141e] z-10">
              <h2 className="text-white font-bold">Buat Review</h2>
              <button onClick={closeForm} disabled={saving} className="text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
                <div className="grid grid-cols-3 gap-2">
                  {(['daily','weekly','monthly'] as const).map(p => (
                    <button key={p} type="button" onClick={() => handlePeriodChange(p)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        form.period_type === p ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'border-[#2a2a3a] text-gray-500 hover:text-gray-300'
                      }`}>
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Dari</label><input type="date" className={inp} value={form.period_start} onChange={e => setF('period_start', e.target.value)} /></div>
                  <div><label className={lbl}>Sampai</label><input type="date" className={inp} value={form.period_end} onChange={e => setF('period_end', e.target.value)} /></div>
                </div>

                {form.period_start && form.period_end && (() => {
                  const pt = getTradesForPeriod(form.period_start, form.period_end)
                  if (!pt.length) return <p className="text-gray-500 text-xs bg-[#1a1a2a] rounded-xl p-3 text-center">Tidak ada trade di periode ini</p>
                  const s = calcDashboardStats(pt)
                  return (
                    <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-xl p-3">
                      <p className="text-gray-400 text-xs mb-3">Stats periode ini ({pt.length} trades)</p>
                      <div className="grid grid-cols-4 gap-2">
                        <MiniStat label="Trades" value={String(pt.length)} color="text-white" />
                        <MiniStat label="Win Rate" value={`${s.win_rate}%`} color={s.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
                        <MiniStat label="Net P/L" value={`${s.net_pnl >= 0 ? '+' : ''}$${s.net_pnl}`} color={s.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                        <MiniStat label="Drawdown" value={`$${s.max_drawdown}`} color="text-red-400" />
                      </div>
                    </div>
                  )
                })()}

                <div><label className={lbl}>Yang berjalan baik</label><textarea className={ta} rows={2} value={form.what_worked} onChange={e => setF('what_worked', e.target.value)} placeholder="Strategi atau keputusan yang menghasilkan..." /></div>
                <div><label className={lbl}>Kesalahan terbesar</label><textarea className={ta} rows={2} value={form.biggest_mistake} onChange={e => setF('biggest_mistake', e.target.value)} placeholder="Apa yang seharusnya tidak dilakukan..." /></div>
                <div><label className={lbl}>Pelajaran utama</label><textarea className={ta} rows={2} value={form.main_lesson} onChange={e => setF('main_lesson', e.target.value)} placeholder="Insight terpenting yang didapat..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Strategi dilanjutkan</label><textarea className={ta} rows={1} value={form.strategy_continue} onChange={e => setF('strategy_continue', e.target.value)} placeholder="Yang tetap dipakai..." /></div>
                  <div><label className={lbl}>Strategi dihentikan</label><textarea className={ta} rows={1} value={form.strategy_stop} onChange={e => setF('strategy_stop', e.target.value)} placeholder="Yang perlu dievaluasi..." /></div>
                </div>
                <div><label className={lbl}>Rencana perbaikan</label><textarea className={ta} rows={2} value={form.improvement_plan} onChange={e => setF('improvement_plan', e.target.value)} placeholder="Apa yang akan dilakukan berbeda..." /></div>

                <div className="flex items-center justify-between bg-[#1a1a2a] rounded-xl px-4 py-3">
                  <label className="text-gray-300 text-sm">Risk management dipatuhi?</label>
                  <button type="button" onClick={() => setF('risk_management_ok', !form.risk_management_ok)}
                    className={`w-12 h-6 rounded-full transition-all relative ${form.risk_management_ok ? 'bg-blue-600' : 'bg-[#2a2a3a]'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.risk_management_ok ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div>
                  <label className={lbl}>Rating Keseluruhan: <span className="text-blue-400 font-bold">{form.overall_rating}/10</span></label>
                  <input type="range" min={1} max={10} className="w-full accent-blue-500 mt-1" value={form.overall_rating} onChange={e => setF('overall_rating', +e.target.value)} />
                  <div className="flex justify-between text-gray-600 text-xs mt-0.5"><span>Buruk</span><span>Luar Biasa</span></div>
                </div>
              </fieldset>

              <div className="flex gap-3 pt-2">
                <button onClick={closeForm} disabled={saving} className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50">Batal</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center py-16 gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <p className="text-gray-400 text-sm">Belum ada review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const isExpanded = expandedId === r.id
            const snap = r.stats_snapshot as unknown as DashboardStats | null
            return (
              <div key={r.id} className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#1a1a2a] transition-colors text-left">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-lg font-bold border ${PERIOD_COLORS[r.period_type]}`}>
                      {PERIOD_LABELS[r.period_type]}
                    </span>
                    <span className="text-gray-300 text-sm font-medium">{r.period_start} — {r.period_end}</span>
                    {r.risk_management_ok && (
                      <span className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">Risk OK</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StarRating rating={r.overall_rating} />
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </button>

                {snap && snap.total_trades > 0 && (
                  <div className="px-5 pb-3 grid grid-cols-4 gap-2 border-t border-[#1e1e2e]">
                    <MiniStat label="Trades" value={String(snap.total_trades)} color="text-white" />
                    <MiniStat label="Win Rate" value={`${snap.win_rate}%`} color={snap.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
                    <MiniStat label="Net P/L" value={`${snap.net_pnl >= 0 ? '+' : ''}$${snap.net_pnl}`} color={snap.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <MiniStat label="Drawdown" value={`$${snap.max_drawdown}`} color="text-red-400" />
                  </div>
                )}

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-3 border-t border-[#2a2a3a] pt-4">
                    {r.what_worked && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <p className="text-emerald-400 text-xs font-medium mb-1">Yang Berhasil</p>
                        <p className="text-gray-300 text-sm">{r.what_worked}</p>
                      </div>
                    )}
                    {r.biggest_mistake && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                        <p className="text-red-400 text-xs font-medium mb-1">Kesalahan Terbesar</p>
                        <p className="text-red-300 text-sm">{r.biggest_mistake}</p>
                      </div>
                    )}
                    {r.main_lesson && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-blue-400 text-xs font-medium mb-1">Pelajaran Utama</p>
                        <p className="text-gray-300 text-sm">{r.main_lesson}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {r.strategy_continue && (
                        <div><p className="text-gray-500 text-xs mb-1">Dilanjutkan</p><p className="text-gray-300 text-sm">{r.strategy_continue}</p></div>
                      )}
                      {r.strategy_stop && (
                        <div><p className="text-gray-500 text-xs mb-1">Dihentikan</p><p className="text-red-300 text-sm">{r.strategy_stop}</p></div>
                      )}
                    </div>
                    {r.improvement_plan && (
                      <div><p className="text-gray-500 text-xs mb-1">Rencana Perbaikan</p><p className="text-gray-300 text-sm">{r.improvement_plan}</p></div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
