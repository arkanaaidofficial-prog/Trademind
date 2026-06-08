'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  TRADE_SCREENSHOTS_BUCKET,
  getScreenshotDisplayUrl,
  getScreenshotStoragePath,
  serializeScreenshots,
  type StoredScreenshot,
} from '@/lib/supabase/storage'
import { tradeFormSchema } from '@/lib/validators/tradeSchema'
import { toast } from 'sonner'
import type { Trade } from '@/types/trade'
import { useRuleViolations } from '@/hooks/useRuleViolations'
import RuleViolationBanner from '@/components/trades/RuleViolationBanner'

const TIMEFRAMES = ['1m','5m','15m','30m','1H','4H','1D','1W']
const SETUPS     = ['breakout','pullback','trend_following','reversal','scalping','news','range','other']
const EMOTIONS   = ['tenang','takut','FOMO','serakah','ragu','revenge_trading','percaya_diri_berlebihan','percaya_diri']
const CONDITIONS = ['trending','ranging','volatile','low_volume','high_volume']

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600'
const sel = inp + ' cursor-pointer'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'
const ta  = inp + ' resize-none'

interface Props {
  trade?:  Partial<Trade>
  userId:  string
  mode:    'add' | 'edit'
}

type ScreenshotItem = StoredScreenshot & { url: string; name: string }

const STEPS = [
  { label: 'Trade',     desc: 'Info dasar'     },
  { label: 'Harga',     desc: 'Entry & hasil'   },
  { label: 'Catatan',   desc: 'Review & foto'   },
  { label: 'Psikologi', desc: 'Kondisi mental'  },
]

export default function TradeForm({ trade, userId, mode }: Props) {
  const router = useRouter()
  const [step,        setStep]        = useState(0)
  const [saving,      setSaving]      = useState(false)
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([])
  const [uploading,   setUploading]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load existing screenshots when editing ─────────────────
  useEffect(() => {
    const raw = (trade as { screenshots?: StoredScreenshot[] } | undefined)?.screenshots ?? []
    if (!raw.length) { setScreenshots([]); return }
    let active = true
    async function load() {
      const supabase  = createClient()
      const prepared  = await Promise.all(raw.map(async sc => ({
        ...sc,
        name: sc.name ?? 'screenshot',
        url:  await getScreenshotDisplayUrl(supabase, sc),
      })))
      if (active) setScreenshots(prepared.filter(sc => sc.url))
    }
    load()
    return () => { active = false }
  }, [trade])

  // ── Form state ─────────────────────────────────────────────
  const [form, setForm] = useState({
    symbol:              trade?.symbol           ?? '',
    market_type:         trade?.market_type      ?? 'crypto',
    exchange:            trade?.exchange         ?? '',
    position_type:       trade?.position_type    ?? 'long',
    mode:                trade?.mode             ?? 'manual',
    bot_name:            trade?.bot_name         ?? '',
    bot_version:         trade?.bot_version      ?? '',
    strategy_name:       trade?.strategy_name    ?? '',
    setup_type:          trade?.setup_type       ?? '',
    timeframe:           trade?.timeframe        ?? '',
    market_condition:    trade?.market_condition ?? '',
    entry_at:  trade?.entry_at  ? trade.entry_at.slice(0,16)  : new Date().toISOString().slice(0,16),
    exit_at:   trade?.exit_at   ? trade.exit_at.slice(0,16)   : '',
    entry_price:    trade?.entry_price    ?? '',
    exit_price:     trade?.exit_price     ?? '',
    position_size:  trade?.position_size  ?? '',
    leverage:       trade?.leverage       ?? 1,
    stop_loss:      trade?.stop_loss      ?? '',
    take_profit:    trade?.take_profit    ?? '',
    risk_amount:    trade?.risk_amount    ?? '',
    risk_percent:   trade?.risk_percent   ?? '',
    fee:            trade?.fee            ?? '',
    funding_fee:    trade?.funding_fee    ?? '',
    gross_pnl:      trade?.gross_pnl      ?? '',
    net_pnl:        trade?.net_pnl        ?? '',
    result:         trade?.result         ?? '',
    entry_reason:   trade?.entry_reason   ?? '',
    exit_reason:    trade?.exit_reason    ?? '',
    mistake_notes:  trade?.mistake_notes  ?? '',
    lesson_learned: trade?.lesson_learned ?? '',
    // Psychology
    emotion_before:       '',
    discipline_score:     7,
    setup_quality_score:  7,
    followed_plan_entry:  true,
    followed_plan_exit:   true,
    revenge_trade:        false,
    oversized:            false,
    psych_notes:          '',
  })

  function set(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Rule violations — computed from form values ────────────
  const { violations, todayCount, hasRules } = useRuleViolations({
    symbol:       form.symbol,
    risk_percent: form.risk_percent,
    entry_at:     form.entry_at,
    mode:         form.mode,
  })

  const hasErrors   = violations.some(v => v.severity === 'error')
  const hasWarnings = violations.some(v => v.severity === 'warning')

  // ── Auto-calc net P/L ──────────────────────────────────────
  function handlePnlChange(key: 'gross_pnl' | 'fee' | 'funding_fee', val: string) {
    set(key, val)
    const gross = key === 'gross_pnl' ? Number(val) : Number(form.gross_pnl)
    const fee   = key === 'fee'        ? Number(val) : Number(form.fee)
    const ff    = key === 'funding_fee'? Number(val) : Number(form.funding_fee)
    if (gross) set('net_pnl', String(Math.round((gross - fee - ff) * 100) / 100))
  }

  // ── Auto-set result from net P/L ──────────────────────────
  function handleNetPnl(val: string) {
    set('net_pnl', val)
    const n = Number(val)
    if      (n > 0)            set('result', 'win')
    else if (n < 0)            set('result', 'loss')
    else if (n === 0 && val !== '') set('result', 'breakeven')
  }

  // ── Step validation ────────────────────────────────────────
  function validateStep0() {
    if (!form.symbol.trim()) { toast.error('Symbol wajib diisi');      return false }
    if (!form.entry_price)   { toast.error('Entry price wajib diisi'); return false }
    return true
  }

  function nextStep() {
    if (step === 0 && !validateStep0()) return
    setStep(s => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function prevStep() {
    setStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Screenshot handlers ────────────────────────────────────
  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (screenshots.length + files.length > 5) { toast.error('Maksimal 5 screenshot'); return }
    setUploading(true)
    const supabase   = createClient()
    const uploaded: ScreenshotItem[] = []
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} terlalu besar`); continue }
      const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${userId}/screenshots/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(TRADE_SCREENSHOTS_BUCKET).upload(path, file)
      if (error) { toast.error(`Gagal: ${error.message}`); continue }
      const { data: signed } = await supabase.storage.from(TRADE_SCREENSHOTS_BUCKET).createSignedUrl(path, 3600)
      if (signed?.signedUrl) uploaded.push({ path, url: signed.signedUrl, name: file.name })
    }
    setScreenshots(prev => [...prev, ...uploaded])
    if (uploaded.length) toast.success(`${uploaded.length} screenshot diupload!`)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeScreenshot(idx: number) {
    const supabase    = createClient()
    const sc          = screenshots[idx]
    const storagePath = getScreenshotStoragePath(sc)
    if (storagePath) {
      const { error } = await supabase.storage.from(TRADE_SCREENSHOTS_BUCKET).remove([storagePath])
      if (error) { toast.error('Gagal hapus: ' + error.message); return }
    }
    setScreenshots(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Submit ─────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true)
    const supabase = createClient()

    const tradePayload = {
      user_id:        userId,
      symbol:         form.symbol.toUpperCase().trim(),
      market_type:    form.market_type,
      exchange:       form.exchange        || null,
      position_type:  form.position_type,
      mode:           form.mode,
      bot_name:       form.bot_name        || null,
      bot_version:    form.bot_version     || null,
      strategy_name:  form.strategy_name   || null,
      setup_type:     form.setup_type      || null,
      timeframe:      form.timeframe       || null,
      entry_at:       new Date(form.entry_at).toISOString(),
      exit_at:        form.exit_at ? new Date(form.exit_at).toISOString() : null,
      entry_price:    Number(form.entry_price),
      exit_price:     form.exit_price     ? Number(form.exit_price)    : null,
      position_size:  form.position_size  ? Number(form.position_size) : null,
      leverage:       Number(form.leverage) || 1,
      stop_loss:      form.stop_loss      ? Number(form.stop_loss)     : null,
      take_profit:    form.take_profit    ? Number(form.take_profit)   : null,
      risk_amount:    form.risk_amount    ? Number(form.risk_amount)   : null,
      risk_percent:   form.risk_percent   ? Number(form.risk_percent)  : null,
      fee:            form.fee            ? Number(form.fee)           : 0,
      funding_fee:    form.funding_fee    ? Number(form.funding_fee)   : 0,
      gross_pnl:      form.gross_pnl      ? Number(form.gross_pnl)    : null,
      net_pnl:        form.net_pnl        ? Number(form.net_pnl)       : null,
      result:         form.result         || null,
      market_condition: form.market_condition || null,
      entry_reason:   form.entry_reason   || null,
      exit_reason:    form.exit_reason    || null,
      mistake_notes:  form.mistake_notes  || null,
      lesson_learned: form.lesson_learned || null,
      screenshots:    serializeScreenshots(screenshots),
      // Store violations so they appear in trade detail
      rule_violations: violations.map(v => ({
        rule:       v.rule,
        message:    v.message,
        severity:   v.severity,
        flagged_at: new Date().toISOString(),
      })),
    }

    let tradeId = trade?.id
    if (mode === 'add') {
      const { data, error } = await supabase.from('trades').insert(tradePayload).select().single()
      if (error) { toast.error('Gagal: ' + error.message); setSaving(false); return }
      tradeId = data.id
    } else {
      const { error } = await supabase
        .from('trades')
        .update({ ...tradePayload, updated_at: new Date().toISOString() })
        .eq('id', trade!.id!)
      if (error) { toast.error('Gagal: ' + error.message); setSaving(false); return }
    }

    // Save psychology
    if (form.emotion_before && tradeId) {
      await supabase.from('trade_psychology').upsert({
        trade_id:            tradeId,
        user_id:             userId,
        emotion_before:      form.emotion_before,
        discipline_score:    form.discipline_score,
        setup_quality_score: form.setup_quality_score,
        followed_plan_entry: form.followed_plan_entry,
        followed_plan_exit:  form.followed_plan_exit,
        revenge_trade:       form.revenge_trade,
        oversized:           form.oversized,
        notes:               form.psych_notes || null,
      }, { onConflict: 'trade_id' })
    }

    if (violations.length > 0) {
      toast.warning(`Trade disimpan dengan ${violations.length} catatan pelanggaran rules`)
    } else {
      toast.success(mode === 'add' ? 'Trade berhasil ditambahkan!' : 'Trade diupdate!')
    }
    router.push(tradeId ? `/trades/${tradeId}` : '/trades')
    router.refresh()
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto p-4 pb-10">

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-0 mb-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => { if (i < step || (i === step + 1 && validateStep0())) setStep(i) }}
                className={`w-8 h-8 rounded-full text-xs font-bold border-2 transition-all flex-shrink-0 ${
                  i === step ? 'bg-blue-600 border-blue-600 text-white'
                  : i < step  ? 'bg-emerald-500 border-emerald-500 text-white'
                  :              'bg-[#1a1a2a] border-[#2a2a3a] text-gray-500'
                }`}
              >
                {i < step ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-4 h-4 mx-auto">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-emerald-500' : 'bg-[#2a2a3a]'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {STEPS.map((s, i) => (
            <div key={i} className="text-center" style={{ width: '25%' }}>
              <p className={`text-xs font-medium ${
                i === step ? 'text-blue-400' : i < step ? 'text-emerald-400' : 'text-gray-600'
              }`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 0: Info Dasar ─────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-sm">
              Info Dasar <span className="text-gray-500 font-normal">(wajib)</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Pair / Symbol *</label>
                <input
                  className={inp}
                  value={form.symbol}
                  onChange={e => set('symbol', e.target.value.toUpperCase())}
                  placeholder="BTCUSDT"
                  autoFocus
                />
              </div>
              <div>
                <label className={lbl}>Side *</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['long','short'].map(v => (
                    <button key={v} type="button" onClick={() => set('position_type', v)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        form.position_type === v
                          ? v === 'long'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'border-[#2a2a3a] text-gray-500'
                      }`}>{v.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className={lbl}>Entry Price *</label>
              <input type="number" step="any" className={inp} value={form.entry_price}
                onChange={e => set('entry_price', e.target.value)} placeholder="67000" />
            </div>

            <div>
              <label className={lbl}>Tanggal & Waktu Entry</label>
              <input type="datetime-local" className={inp} value={form.entry_at}
                onChange={e => set('entry_at', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Market</label>
                <select className={sel} value={form.market_type} onChange={e => set('market_type', e.target.value)}>
                  {['crypto','forex','saham','futures','other'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Exchange</label>
                <input className={inp} value={form.exchange}
                  onChange={e => set('exchange', e.target.value)} placeholder="Binance" />
              </div>
            </div>

            <div>
              <label className={lbl}>Mode Trading</label>
              <div className="grid grid-cols-4 gap-2">
                {['manual','bot','copytrade','signal'].map(v => (
                  <button key={v} type="button" onClick={() => set('mode', v)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                      form.mode === v
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                        : 'border-[#2a2a3a] text-gray-500'
                    }`}>{v}</button>
                ))}
              </div>
            </div>

            {form.mode === 'bot' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nama Bot</label>
                  <input className={inp} value={form.bot_name}
                    onChange={e => set('bot_name', e.target.value)} placeholder="OMAD Bot" />
                </div>
                <div>
                  <label className={lbl}>Versi</label>
                  <input className={inp} value={form.bot_version}
                    onChange={e => set('bot_version', e.target.value)} placeholder="v1.0" />
                </div>
              </div>
            )}
          </div>

          {/* Strategi (opsional) */}
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-3">
            <h2 className="text-gray-400 text-sm font-medium">
              Strategi <span className="text-gray-600">(opsional)</span>
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nama Strategi</label>
                <input className={inp} value={form.strategy_name}
                  onChange={e => set('strategy_name', e.target.value)} placeholder="Breakout EMA" />
              </div>
              <div>
                <label className={lbl}>Setup</label>
                <select className={sel} value={form.setup_type} onChange={e => set('setup_type', e.target.value)}>
                  <option value="">— Pilih —</option>
                  {SETUPS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Timeframe</label>
                <select className={sel} value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
                  <option value="">— Pilih —</option>
                  {TIMEFRAMES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Kondisi Pasar</label>
                <select className={sel} value={form.market_condition} onChange={e => set('market_condition', e.target.value)}>
                  <option value="">— Pilih —</option>
                  {CONDITIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Rule Violation Banner — tampil realtime di step 0 ── */}
          {hasRules && violations.length > 0 && (
            <RuleViolationBanner violations={violations} />
          )}
        </div>
      )}

      {/* ── STEP 1: Harga & Hasil ──────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-sm">Harga & Waktu Exit</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Exit Price</label>
                <input type="number" step="any" className={inp} value={form.exit_price}
                  onChange={e => set('exit_price', e.target.value)} placeholder="68500" />
              </div>
              <div>
                <label className={lbl}>Tanggal Exit</label>
                <input type="datetime-local" className={inp} value={form.exit_at}
                  onChange={e => set('exit_at', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Stop Loss</label>
                <input type="number" step="any" className={inp} value={form.stop_loss}
                  onChange={e => set('stop_loss', e.target.value)} placeholder="66000" />
              </div>
              <div>
                <label className={lbl}>Take Profit</label>
                <input type="number" step="any" className={inp} value={form.take_profit}
                  onChange={e => set('take_profit', e.target.value)} placeholder="69000" />
              </div>
              <div>
                <label className={lbl}>Size / Lot</label>
                <input type="number" step="any" className={inp} value={form.position_size}
                  onChange={e => set('position_size', e.target.value)} placeholder="0.05" />
              </div>
              <div>
                <label className={lbl}>Leverage (x)</label>
                <input type="number" min={1} max={200} className={inp} value={form.leverage}
                  onChange={e => set('leverage', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-sm">Hasil Trade</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Gross P/L ($)</label>
                <input type="number" step="any" className={inp} value={form.gross_pnl}
                  onChange={e => handlePnlChange('gross_pnl', e.target.value)} placeholder="75" />
              </div>
              <div>
                <label className={lbl}>Fee ($)</label>
                <input type="number" step="any" className={inp} value={form.fee}
                  onChange={e => handlePnlChange('fee', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>Funding Fee ($)</label>
                <input type="number" step="any" className={inp} value={form.funding_fee}
                  onChange={e => handlePnlChange('funding_fee', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>
                  Net P/L ($)
                  {form.gross_pnl && <span className="text-gray-600 text-[10px] ml-1">auto</span>}
                </label>
                <input type="number" step="any"
                  className={inp + (form.net_pnl && Number(form.net_pnl) >= 0 ? ' text-emerald-400' : form.net_pnl ? ' text-red-400' : '')}
                  value={form.net_pnl} onChange={e => handleNetPnl(e.target.value)} placeholder="63" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Risk Amount ($)</label>
                <input type="number" step="any" className={inp} value={form.risk_amount}
                  onChange={e => set('risk_amount', e.target.value)} placeholder="50" />
              </div>
              <div>
                <label className={lbl}>Risk (%)</label>
                <input type="number" step="any" className={inp} value={form.risk_percent}
                  onChange={e => set('risk_percent', e.target.value)} placeholder="2" />
              </div>
            </div>
            <div>
              <label className={lbl}>Hasil</label>
              <div className="flex gap-2">
                {['win','loss','breakeven'].map(r => (
                  <button key={r} type="button" onClick={() => set('result', r)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                      form.result === r
                        ? r === 'win'  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : r === 'loss' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        :                'bg-gray-500/20 border-gray-500/50 text-gray-300'
                        : 'border-[#2a2a3a] text-gray-500 hover:border-gray-500'
                    }`}>
                    {r === 'win' ? 'Win' : r === 'loss' ? 'Loss' : 'BE'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Catatan & Screenshot ───────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-sm">Catatan Evaluasi</h2>
            <div>
              <label className={lbl}>Alasan Entry</label>
              <textarea className={ta} rows={2} value={form.entry_reason}
                onChange={e => set('entry_reason', e.target.value)} placeholder="Kenapa masuk trade ini?" />
            </div>
            <div>
              <label className={lbl}>Alasan Exit</label>
              <textarea className={ta} rows={2} value={form.exit_reason}
                onChange={e => set('exit_reason', e.target.value)} placeholder="Kenapa keluar?" />
            </div>
            <div>
              <label className={lbl}>Kesalahan</label>
              <textarea className={ta} rows={2} value={form.mistake_notes}
                onChange={e => set('mistake_notes', e.target.value)} placeholder="Apa yang salah?" />
            </div>
            <div>
              <label className={lbl}>Pelajaran</label>
              <textarea className={ta} rows={2} value={form.lesson_learned}
                onChange={e => set('lesson_learned', e.target.value)} placeholder="Apa yang dipelajari?" />
            </div>
          </div>

          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-3">
            <h2 className="text-white font-semibold text-sm">
              Screenshot Chart <span className="text-gray-600 font-normal">(opsional, max 5)</span>
            </h2>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                uploading ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#2a2a3a] hover:border-blue-500/40'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-blue-400 text-xs">Mengupload...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-gray-500">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <p className="text-gray-400 text-sm">Tap untuk upload foto chart</p>
                  <p className="text-gray-600 text-xs">Max 5MB per foto</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={handleScreenshotUpload} />
            {screenshots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {screenshots.map((sc, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-[#2a2a3a] bg-[#1a1a2a]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sc.url} alt={sc.name} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeScreenshot(idx)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-white">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Psychology ─────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-white font-semibold text-sm">Psychology Journal</h2>
              <p className="text-gray-500 text-xs mt-0.5">Opsional — lewati jika tidak ingin mengisi</p>
            </div>

            <div>
              <label className={lbl}>Emosi Sebelum Entry</label>
              <div className="grid grid-cols-2 gap-2">
                {EMOTIONS.map(v => (
                  <button key={v} type="button"
                    onClick={() => set('emotion_before', form.emotion_before === v ? '' : v)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left ${
                      form.emotion_before === v
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                        : 'border-[#2a2a3a] text-gray-500 hover:border-gray-600'
                    }`}>{v}</button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className={lbl + ' mb-0'}>Skor Disiplin</label>
                  <span className="text-blue-400 text-xs font-bold">{form.discipline_score}/10</span>
                </div>
                <input type="range" min={1} max={10} className="w-full accent-blue-500"
                  value={form.discipline_score} onChange={e => set('discipline_score', +e.target.value)} />
                <div className="flex justify-between text-gray-600 text-[10px] mt-0.5">
                  <span>Tidak disiplin</span><span>Sangat disiplin</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className={lbl + ' mb-0'}>Kualitas Setup</label>
                  <span className="text-violet-400 text-xs font-bold">{form.setup_quality_score}/10</span>
                </div>
                <input type="range" min={1} max={10} className="w-full accent-violet-500"
                  value={form.setup_quality_score} onChange={e => set('setup_quality_score', +e.target.value)} />
                <div className="flex justify-between text-gray-600 text-[10px] mt-0.5">
                  <span>Setup jelek</span><span>Setup sempurna</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'followed_plan_entry', label: 'Entry sesuai plan' },
                { key: 'followed_plan_exit',  label: 'Exit sesuai plan'  },
                { key: 'revenge_trade',       label: 'Revenge trade'      },
                { key: 'oversized',           label: 'Posisi terlalu besar' },
              ].map(({ key, label }) => {
                const checked = !!form[key as keyof typeof form]
                const isDanger = key === 'revenge_trade' || key === 'oversized'
                return (
                  <button key={key} type="button" onClick={() => set(key, !checked)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      checked
                        ? isDanger ? 'border-red-500/40 bg-red-500/10' : 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-[#2a2a3a] bg-[#1a1a2a]'
                    }`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      checked
                        ? isDanger ? 'border-red-500 bg-red-500' : 'border-emerald-500 bg-emerald-500'
                        : 'border-[#3a3a4a]'
                    }`}>
                      {checked && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs ${checked ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
                  </button>
                )
              })}
            </div>

            <div>
              <label className={lbl}>Catatan Psychology</label>
              <textarea className={ta} rows={3} value={form.psych_notes}
                onChange={e => set('psych_notes', e.target.value)}
                placeholder="Kondisi mental saat trade ini..." />
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────── */}
      <div className="flex gap-3 mt-6">
        {step > 0 ? (
          <button type="button" onClick={prevStep}
            className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-3.5 rounded-xl text-sm font-medium transition-colors">
            ← Kembali
          </button>
        ) : (
          <button type="button" onClick={() => router.back()}
            className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-3.5 rounded-xl text-sm font-medium transition-colors">
            Batal
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={nextStep}
            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all ${
              hasErrors && step === 0
                ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}>
            {hasErrors && step === 0 ? 'Lanjut (ada pelanggaran)' : 'Lanjut →'}
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-bold transition-colors">
            {saving ? 'Menyimpan...' : mode === 'add' ? 'Simpan Trade' : 'Update Trade'}
          </button>
        )}
      </div>

      {/* Skip hint on last step */}
      {step === 3 && (
        <button type="button" onClick={handleSubmit} disabled={saving}
          className="w-full text-gray-600 text-xs py-2 hover:text-gray-400 transition-colors">
          Lewati — simpan tanpa psychology
        </button>
      )}
    </div>
  )
}
