'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Trade, TradePsychology } from '@/types/trade'

type ScreenshotItem = { url: string; name: string }

function Row({ label, value, mono = false, highlight }: {
  label: string; value?: string | number | null; mono?: boolean; highlight?: 'green' | 'red'
}) {
  const color = highlight === 'green' ? 'text-emerald-400' : highlight === 'red' ? 'text-red-400' : 'text-gray-200'
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-[#1e1e2e] last:border-0">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`text-xs font-medium text-right max-w-[60%] ${mono ? 'font-mono' : ''} ${color}`}>{value ?? '—'}</span>
    </div>
  )
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#1e1e2e] rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-200 w-8 text-right">{score}/10</span>
    </div>
  )
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [trade, setTrade] = useState<Trade | null>(null)
  const [psych, setPsych] = useState<TradePsychology | null>(null)
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: t } = await supabase.from('trades').select('*').eq('id', id).single()
      const { data: p } = await supabase.from('trade_psychology').select('*').eq('trade_id', id).single()
      setTrade(t)
      setPsych(p)
      // Screenshots from JSONB field
      if (t?.screenshots && Array.isArray(t.screenshots)) {
        setScreenshots(t.screenshots as ScreenshotItem[])
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!confirm('Hapus trade ini? Tidak bisa dikembalikan.')) return
    const supabase = createClient()
    await supabase.from('trades').delete().eq('id', id)
    toast.success('Trade dihapus')
    router.push('/trades')
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 animate-pulse text-sm">Memuat...</p></div>
  if (!trade) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Trade tidak ditemukan</p></div>

  const pnl = trade.net_pnl ?? 0
  const duration = trade.entry_at && trade.exit_at
    ? Math.round((new Date(trade.exit_at).getTime() - new Date(trade.entry_at).getTime()) / 60000)
    : null
  const formatDuration = (m: number) => m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m/60)}h ${m%60}m` : `${Math.floor(m/1440)}d ${Math.floor((m%1440)/60)}h`

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-white font-bold text-xl">{trade.symbol}</h1>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${trade.position_type === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {trade.position_type?.toUpperCase()}
            </span>
            <span className="text-xs bg-[#1e1e2e] text-gray-400 px-2 py-1 rounded-lg">{trade.mode}</span>
            {trade.result && (
              <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                trade.result === 'win' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : trade.result === 'loss' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>{trade.result.toUpperCase()}</span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1">
            {new Date(trade.entry_at).toLocaleString('id-ID')}
            {trade.exit_at && ` — ${new Date(trade.exit_at).toLocaleString('id-ID')}`}
            {duration !== null && <span className="ml-2 text-gray-600">({formatDuration(duration)})</span>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${pnl}
          </p>
          <p className="text-gray-500 text-xs">Net P/L</p>
        </div>
      </div>

      {/* Key metrics strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Entry', value: Number(trade.entry_price).toLocaleString() },
          { label: 'Exit', value: trade.exit_price ? Number(trade.exit_price).toLocaleString() : '—' },
          { label: 'Fee', value: `$${trade.fee ?? 0}` },
          { label: 'Gross P/L', value: trade.gross_pnl ? `$${trade.gross_pnl}` : '—' },
        ].map(m => (
          <div key={m.label} className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-3 text-center">
            <p className="text-gray-500 text-[10px] mb-1">{m.label}</p>
            <p className="text-gray-200 text-xs font-mono font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Trade Details */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
        <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Detail Trade</h3>
        <Row label="Exchange" value={trade.exchange} />
        <Row label="Strategy" value={trade.strategy_name} />
        <Row label="Setup" value={trade.setup_type} />
        <Row label="Timeframe" value={trade.timeframe} />
        <Row label="Market Condition" value={trade.market_condition} />
        <Row label="Position Size" value={trade.position_size} mono />
        <Row label="Leverage" value={trade.leverage ? `${trade.leverage}x` : null} />
        <Row label="Stop Loss" value={trade.stop_loss ? Number(trade.stop_loss).toLocaleString() : null} mono />
        <Row label="Take Profit" value={trade.take_profit ? Number(trade.take_profit).toLocaleString() : null} mono />
        <Row label="Risk Amount" value={trade.risk_amount ? `$${trade.risk_amount}` : null} mono />
        <Row label="Risk %" value={trade.risk_percent ? `${trade.risk_percent}%` : null} />
        <Row label="R-Multiple" value={trade.r_multiple ? `${trade.r_multiple}R` : null} />
        <Row label="Funding Fee" value={trade.funding_fee ? `$${trade.funding_fee}` : '$0'} mono />
        {trade.bot_name && <Row label="Bot" value={`${trade.bot_name}${trade.bot_version ? ` ${trade.bot_version}` : ''}`} />}
      </div>

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">
            Screenshot Chart ({screenshots.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {screenshots.map((sc, i) => (
              <div key={i} onClick={() => setLightbox(sc.url)}
                className="relative aspect-video rounded-xl overflow-hidden border border-[#2a2a3a] cursor-pointer hover:border-blue-500/50 transition-colors group bg-[#1a1a2a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sc.url} alt={sc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-white">
                    <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
                  </svg>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                  <p className="text-white text-[9px] truncate">{sc.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="screenshot" className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Notes */}
      {(trade.entry_reason || trade.exit_reason || trade.mistake_notes || trade.lesson_learned) && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
          <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Catatan</h3>
          {trade.entry_reason && (
            <div><p className="text-gray-500 text-xs mb-1">Alasan Entry</p><p className="text-gray-300 text-sm leading-relaxed">{trade.entry_reason}</p></div>
          )}
          {trade.exit_reason && (
            <div><p className="text-gray-500 text-xs mb-1">Alasan Exit</p><p className="text-gray-300 text-sm leading-relaxed">{trade.exit_reason}</p></div>
          )}
          {trade.mistake_notes && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-400 text-xs font-medium mb-1">Kesalahan</p>
              <p className="text-red-300 text-sm leading-relaxed">{trade.mistake_notes}</p>
            </div>
          )}
          {trade.lesson_learned && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-emerald-400 text-xs font-medium mb-1">Pelajaran</p>
              <p className="text-emerald-300 text-sm leading-relaxed">{trade.lesson_learned}</p>
            </div>
          )}
        </div>
      )}

      {/* Psychology */}
      {psych && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
          <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Psychology</h3>
          {psych.emotion_before && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">Emosi Sebelum Entry</span>
              <span className="text-xs bg-[#1e1e2e] text-gray-200 px-2 py-1 rounded-lg">{psych.emotion_before}</span>
            </div>
          )}
          {psych.discipline_score && (
            <div>
              <p className="text-gray-400 text-xs mb-1.5">Skor Disiplin</p>
              <ScoreBar score={psych.discipline_score} color="bg-blue-500" />
            </div>
          )}
          {psych.setup_quality_score && (
            <div>
              <p className="text-gray-400 text-xs mb-1.5">Kualitas Setup</p>
              <ScoreBar score={psych.setup_quality_score} color="bg-violet-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              { label: 'Entry Sesuai Plan', val: psych.followed_plan_entry },
              { label: 'Exit Sesuai Plan', val: psych.followed_plan_exit },
              { label: 'Revenge Trade', val: psych.revenge_trade, invert: true },
              { label: 'Oversized', val: psych.oversized, invert: true },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                item.val === null || item.val === undefined ? 'border-[#2a2a3a] bg-[#1a1a2a]'
                : (item.invert ? !item.val : item.val)
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-red-500/30 bg-red-500/10'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.val === null || item.val === undefined ? 'bg-gray-600'
                  : (item.invert ? !item.val : item.val) ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
                <span className="text-gray-300 text-xs">{item.label}</span>
              </div>
            ))}
          </div>
          {psych.notes && (
            <div><p className="text-gray-500 text-xs mb-1">Catatan Psychology</p><p className="text-gray-300 text-sm">{psych.notes}</p></div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link href="/trades" className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-3 rounded-xl text-sm font-medium transition-colors text-center">
          ← Kembali
        </Link>
        <Link href={`/trades/${id}/edit`} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-colors text-center">
          Edit Trade
        </Link>
        <button onClick={handleDelete} className="px-5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 py-3 rounded-xl text-sm font-medium transition-colors">
          Hapus
        </button>
      </div>
    </div>
  )
}
