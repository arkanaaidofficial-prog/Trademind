'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Trade } from '@/types/trade'

const TIMEFRAMES = ['1m','5m','15m','30m','1H','4H','1D','1W']
const SETUPS = ['breakout','pullback','trend_following','reversal','scalping','news','range','other']
const EMOTIONS = ['tenang','takut','FOMO','serakah','ragu','revenge_trading','percaya_diri_berlebihan','percaya_diri']
const CONDITIONS = ['trending','ranging','volatile','low_volume','high_volume']

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600'
const sel = inp + ' cursor-pointer'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

interface Props {
  trade?: Partial<Trade>
  userId: string
  mode: 'add' | 'edit'
}

type ScreenshotItem = { url: string; name: string }

export default function TradeForm({ trade, userId, mode }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>(
    (trade as { screenshots?: ScreenshotItem[] })?.screenshots ?? []
  )
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    symbol: trade?.symbol ?? '',
    market_type: trade?.market_type ?? 'crypto',
    exchange: trade?.exchange ?? '',
    position_type: trade?.position_type ?? 'long',
    mode: trade?.mode ?? 'manual',
    bot_name: trade?.bot_name ?? '',
    bot_version: trade?.bot_version ?? '',
    strategy_name: trade?.strategy_name ?? '',
    setup_type: trade?.setup_type ?? '',
    timeframe: trade?.timeframe ?? '',
    entry_at: trade?.entry_at ? trade.entry_at.slice(0,16) : new Date().toISOString().slice(0,16),
    exit_at: trade?.exit_at ? trade.exit_at.slice(0,16) : '',
    entry_price: trade?.entry_price ?? '',
    exit_price: trade?.exit_price ?? '',
    position_size: trade?.position_size ?? '',
    leverage: trade?.leverage ?? 1,
    stop_loss: trade?.stop_loss ?? '',
    take_profit: trade?.take_profit ?? '',
    risk_amount: trade?.risk_amount ?? '',
    risk_percent: trade?.risk_percent ?? '',
    fee: trade?.fee ?? 0,
    funding_fee: trade?.funding_fee ?? 0,
    gross_pnl: trade?.gross_pnl ?? '',
    net_pnl: trade?.net_pnl ?? '',
    result: trade?.result ?? '',
    market_condition: trade?.market_condition ?? '',
    entry_reason: trade?.entry_reason ?? '',
    exit_reason: trade?.exit_reason ?? '',
    mistake_notes: trade?.mistake_notes ?? '',
    lesson_learned: trade?.lesson_learned ?? '',
    // Psychology
    emotion_before: '',
    discipline_score: 7,
    setup_quality_score: 7,
    followed_plan_entry: true,
    followed_plan_exit: true,
    revenge_trade: false,
    oversized: false,
    psych_notes: '',
  })

  function set(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (screenshots.length + files.length > 5) {
      toast.error('Maksimal 5 screenshot per trade')
      return
    }
    setUploading(true)
    const supabase = createClient()
    const uploaded: ScreenshotItem[] = []

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} terlalu besar (max 5MB)`)
        continue
      }
      const ext = file.name.split('.').pop()
      const path = `screenshots/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('trade-screenshots')
        .upload(path, file, { upsert: false })
      if (error) {
        toast.error(`Gagal upload ${file.name}: ${error.message}`)
        continue
      }
      const { data: urlData } = supabase.storage.from('trade-screenshots').getPublicUrl(path)
      uploaded.push({ url: urlData.publicUrl, name: file.name })
    }

    setScreenshots(prev => [...prev, ...uploaded])
    if (uploaded.length) toast.success(`${uploaded.length} screenshot berhasil diupload!`)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeScreenshot(idx: number) {
    setScreenshots(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.symbol || !form.entry_price || !form.position_type) {
      toast.error('Symbol, entry price, dan posisi wajib diisi')
      return
    }
    setSaving(true)

    const supabase = createClient()

    const tradePayload = {
      user_id: userId,
      symbol: form.symbol.toUpperCase(),
      market_type: form.market_type,
      exchange: form.exchange || null,
      position_type: form.position_type,
      mode: form.mode,
      bot_name: form.bot_name || null,
      bot_version: form.bot_version || null,
      strategy_name: form.strategy_name || null,
      setup_type: form.setup_type || null,
      timeframe: form.timeframe || null,
      entry_at: new Date(form.entry_at).toISOString(),
      exit_at: form.exit_at ? new Date(form.exit_at).toISOString() : null,
      entry_price: Number(form.entry_price),
      exit_price: form.exit_price ? Number(form.exit_price) : null,
      position_size: form.position_size ? Number(form.position_size) : null,
      leverage: Number(form.leverage) || 1,
      stop_loss: form.stop_loss ? Number(form.stop_loss) : null,
      take_profit: form.take_profit ? Number(form.take_profit) : null,
      risk_amount: form.risk_amount ? Number(form.risk_amount) : null,
      risk_percent: form.risk_percent ? Number(form.risk_percent) : null,
      fee: Number(form.fee) || 0,
      funding_fee: Number(form.funding_fee) || 0,
      gross_pnl: form.gross_pnl ? Number(form.gross_pnl) : null,
      net_pnl: form.net_pnl ? Number(form.net_pnl) : null,
      result: form.result || null,
      market_condition: form.market_condition || null,
      entry_reason: form.entry_reason || null,
      exit_reason: form.exit_reason || null,
      mistake_notes: form.mistake_notes || null,
      lesson_learned: form.lesson_learned || null,
      screenshots: screenshots.length > 0 ? screenshots : null,
    }

    let tradeId = trade?.id
    if (mode === 'add') {
      const { data, error } = await supabase.from('trades').insert(tradePayload).select().single()
      if (error) { toast.error('Gagal menyimpan trade: ' + error.message); setSaving(false); return }
      tradeId = data.id
    } else {
      const { error } = await supabase.from('trades').update({ ...tradePayload, updated_at: new Date().toISOString() }).eq('id', trade!.id!)
      if (error) { toast.error('Gagal update trade: ' + error.message); setSaving(false); return }
    }

    // Save psychology if emotion filled
    if (form.emotion_before && tradeId) {
      await supabase.from('trade_psychology').upsert({
        trade_id: tradeId,
        user_id: userId,
        emotion_before: form.emotion_before,
        discipline_score: form.discipline_score,
        setup_quality_score: form.setup_quality_score,
        followed_plan_entry: form.followed_plan_entry,
        followed_plan_exit: form.followed_plan_exit,
        revenge_trade: form.revenge_trade,
        oversized: form.oversized,
        notes: form.psych_notes || null,
      }, { onConflict: 'trade_id' })
    }

    toast.success(mode === 'add' ? 'Trade berhasil ditambahkan!' : 'Trade berhasil diupdate!')
    router.push(tradeId ? `/trades/${tradeId}` : '/trades')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Section: Identifikasi */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Identifikasi Trade</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={lbl}>Symbol / Pair *</label>
            <input className={inp} value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="BTCUSDT" required />
          </div>
          <div>
            <label className={lbl}>Market Type</label>
            <select className={sel} value={form.market_type} onChange={e => set('market_type', e.target.value)}>
              {['crypto','forex','saham','futures','other'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Exchange / Broker</label>
            <input className={inp} value={form.exchange} onChange={e => set('exchange', e.target.value)} placeholder="Binance, Bybit..." />
          </div>
          <div>
            <label className={lbl}>Side *</label>
            <select className={sel} value={form.position_type} onChange={e => set('position_type', e.target.value)} required>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Mode</label>
            <select className={sel} value={form.mode} onChange={e => set('mode', e.target.value)}>
              {['manual','bot','copytrade','signal'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          {form.mode === 'bot' && <>
            <div>
              <label className={lbl}>Nama Bot</label>
              <input className={inp} value={form.bot_name} onChange={e => set('bot_name', e.target.value)} placeholder="OMAD SNIPER v11" />
            </div>
            <div>
              <label className={lbl}>Versi Bot</label>
              <input className={inp} value={form.bot_version} onChange={e => set('bot_version', e.target.value)} placeholder="v11.2" />
            </div>
          </>}
        </div>
      </div>

      {/* Section: Strategi */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Strategi & Setup</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Nama Strategi</label>
            <input className={inp} value={form.strategy_name} onChange={e => set('strategy_name', e.target.value)} placeholder="Breakout EMA" />
          </div>
          <div>
            <label className={lbl}>Setup Type</label>
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
            <label className={lbl}>Market Condition</label>
            <select className={sel} value={form.market_condition} onChange={e => set('market_condition', e.target.value)}>
              <option value="">— Pilih —</option>
              {CONDITIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section: Harga & Waktu */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Harga & Waktu</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Entry Price *</label>
            <input type="number" step="any" className={inp} value={form.entry_price} onChange={e => set('entry_price', e.target.value)} placeholder="67000" required />
          </div>
          <div>
            <label className={lbl}>Exit Price</label>
            <input type="number" step="any" className={inp} value={form.exit_price} onChange={e => set('exit_price', e.target.value)} placeholder="68500" />
          </div>
          <div>
            <label className={lbl}>Entry Date & Time *</label>
            <input type="datetime-local" className={inp} value={form.entry_at} onChange={e => set('entry_at', e.target.value)} required />
          </div>
          <div>
            <label className={lbl}>Exit Date & Time</label>
            <input type="datetime-local" className={inp} value={form.exit_at} onChange={e => set('exit_at', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Section: Sizing & Risk */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Position Sizing & Risk</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Position Size</label>
            <input type="number" step="any" className={inp} value={form.position_size} onChange={e => set('position_size', e.target.value)} placeholder="0.05" />
          </div>
          <div>
            <label className={lbl}>Leverage (x)</label>
            <input type="number" min={1} max={200} className={inp} value={form.leverage} onChange={e => set('leverage', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Stop Loss</label>
            <input type="number" step="any" className={inp} value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)} placeholder="66000" />
          </div>
          <div>
            <label className={lbl}>Take Profit</label>
            <input type="number" step="any" className={inp} value={form.take_profit} onChange={e => set('take_profit', e.target.value)} placeholder="69000" />
          </div>
          <div>
            <label className={lbl}>Risk Amount ($)</label>
            <input type="number" step="any" className={inp} value={form.risk_amount} onChange={e => set('risk_amount', e.target.value)} placeholder="50" />
          </div>
          <div>
            <label className={lbl}>Risk (%)</label>
            <input type="number" step="any" className={inp} value={form.risk_percent} onChange={e => set('risk_percent', e.target.value)} placeholder="2" />
          </div>
        </div>
      </div>

      {/* Section: Hasil */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Hasil Trade</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Gross P/L ($)</label>
            <input type="number" step="any" className={inp} value={form.gross_pnl} onChange={e => set('gross_pnl', e.target.value)} placeholder="75" />
          </div>
          <div>
            <label className={lbl}>Net P/L ($)</label>
            <input type="number" step="any" className={inp} value={form.net_pnl} onChange={e => set('net_pnl', e.target.value)} placeholder="63" />
          </div>
          <div>
            <label className={lbl}>Fee ($)</label>
            <input type="number" step="any" className={inp} value={form.fee} onChange={e => set('fee', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Funding Fee ($)</label>
            <input type="number" step="any" className={inp} value={form.funding_fee} onChange={e => set('funding_fee', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Result</label>
            <div className="flex gap-3">
              {['win','loss','breakeven'].map(r => (
                <button key={r} type="button" onClick={() => set('result', r)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    form.result === r
                      ? r === 'win' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : r === 'loss' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'bg-gray-500/20 border-gray-500/50 text-gray-300'
                      : 'border-[#2a2a3a] text-gray-500 hover:border-gray-500'
                  }`}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Screenshot */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Screenshot Chart</h2>
        <p className="text-gray-500 text-xs">Upload bukti chart, setup, atau hasil trade kamu. Max 5 gambar, masing-masing max 5MB.</p>

        {/* Upload area */}
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            uploading ? 'border-blue-500/50 bg-blue-500/5' : 'border-[#2a2a3a] hover:border-blue-500/50 hover:bg-blue-500/5'
          }`}>
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-blue-400 text-xs">Mengupload...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="text-3xl">📸</div>
              <p className="text-gray-400 text-sm font-medium">Klik untuk upload screenshot</p>
              <p className="text-gray-600 text-xs">PNG, JPG, WEBP • Max 5MB per file • Max 5 gambar</p>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleScreenshotUpload}
        />

        {/* Preview grid */}
        {screenshots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {screenshots.map((sc, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#2a2a3a] aspect-video bg-[#1a1a2a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sc.url} alt={sc.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a href={sc.url} target="_blank" rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded-lg transition-colors">
                    Lihat
                  </a>
                  <button type="button" onClick={() => removeScreenshot(idx)}
                    className="bg-red-500/60 hover:bg-red-500 text-white text-xs px-2 py-1 rounded-lg transition-colors">
                    Hapus
                  </button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1">
                  <p className="text-white text-[9px] truncate">{sc.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Notes */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Catatan & Evaluasi</h2>
        <div>
          <label className={lbl}>Alasan Entry</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.entry_reason} onChange={e => set('entry_reason', e.target.value)} placeholder="Kenapa kamu masuk trade ini?" />
        </div>
        <div>
          <label className={lbl}>Alasan Exit</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.exit_reason} onChange={e => set('exit_reason', e.target.value)} placeholder="Kenapa kamu keluar?" />
        </div>
        <div>
          <label className={lbl}>Catatan Kesalahan</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.mistake_notes} onChange={e => set('mistake_notes', e.target.value)} placeholder="Apa yang salah?" />
        </div>
        <div>
          <label className={lbl}>Pelajaran</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.lesson_learned} onChange={e => set('lesson_learned', e.target.value)} placeholder="Apa yang kamu pelajari?" />
        </div>
      </div>

      {/* Section: Psychology */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Psychology Journal</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Emosi Sebelum Entry</label>
            <select className={sel} value={form.emotion_before} onChange={e => set('emotion_before', e.target.value)}>
              <option value="">— Pilih —</option>
              {EMOTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Skor Disiplin: <span className="text-blue-400 font-bold">{form.discipline_score}/10</span></label>
            <input type="range" min={1} max={10} className="w-full accent-blue-500 mt-2" value={form.discipline_score} onChange={e => set('discipline_score', +e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Kualitas Setup: <span className="text-violet-400 font-bold">{form.setup_quality_score}/10</span></label>
            <input type="range" min={1} max={10} className="w-full accent-violet-500 mt-2" value={form.setup_quality_score} onChange={e => set('setup_quality_score', +e.target.value)} />
          </div>
          <div className="space-y-2">
            {[
              { key: 'followed_plan_entry', label: 'Entry sesuai plan' },
              { key: 'followed_plan_exit', label: 'Exit sesuai plan' },
              { key: 'revenge_trade', label: 'Revenge trade' },
              { key: 'oversized', label: 'Oversized position' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-blue-500 w-4 h-4"
                  checked={!!form[key as keyof typeof form]}
                  onChange={e => set(key, e.target.checked)} />
                <span className="text-gray-300 text-xs">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl}>Catatan Psychology</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.psych_notes} onChange={e => set('psych_notes', e.target.value)} placeholder="Kondisi mental & emosi kamu saat trade ini..." />
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pb-6">
        <button type="button" onClick={() => router.back()} className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-3 rounded-xl text-sm font-medium transition-colors">
          Batal
        </button>
        <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors">
          {saving ? 'Menyimpan...' : mode === 'add' ? 'Simpan Trade' : 'Update Trade'}
        </button>
      </div>
    </form>
  )
}
