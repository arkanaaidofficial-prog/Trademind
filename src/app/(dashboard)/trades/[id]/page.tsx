'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Trade, TradePsychology } from '@/types/trade'

function Row({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-[#1e1e2e] last:border-0">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`text-gray-200 text-xs font-medium text-right max-w-[60%] ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [trade, setTrade] = useState<Trade | null>(null)
  const [psych, setPsych] = useState<TradePsychology | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: t } = await supabase.from('trades').select('*').eq('id', id).single()
      const { data: p } = await supabase.from('trade_psychology').select('*').eq('trade_id', id).single()
      setTrade(t)
      setPsych(p)
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

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
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
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${pnl}
          </p>
          <p className="text-gray-500 text-xs">Net P/L</p>
        </div>
      </div>

      {/* Trade Details */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
        <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Detail Trade</h3>
        <Row label="Exchange" value={trade.exchange} />
        <Row label="Strategy" value={trade.strategy_name} />
        <Row label="Setup" value={trade.setup_type} />
        <Row label="Timeframe" value={trade.timeframe} />
        <Row label="Market Condition" value={trade.market_condition} />
        <Row label="Entry Price" value={Number(trade.entry_price).toLocaleString()} mono />
        <Row label="Exit Price" value={trade.exit_price ? Number(trade.exit_price).toLocaleString() : null} mono />
        <Row label="Position Size" value={trade.position_size} mono />
        <Row label="Leverage" value={trade.leverage ? `${trade.leverage}x` : null} />
        <Row label="Stop Loss" value={trade.stop_loss ? Number(trade.stop_loss).toLocaleString() : null} mono />
        <Row label="Take Profit" value={trade.take_profit ? Number(trade.take_profit).toLocaleString() : null} mono />
        <Row label="Risk Amount" value={trade.risk_amount ? `$${trade.risk_amount}` : null} mono />
        <Row label="Risk %" value={trade.risk_percent ? `${trade.risk_percent}%` : null} />
        <Row label="Gross P/L" value={trade.gross_pnl ? `$${trade.gross_pnl}` : null} mono />
        <Row label="Fee" value={trade.fee ? `$${trade.fee}` : '$0'} mono />
        <Row label="Funding Fee" value={trade.funding_fee ? `$${trade.funding_fee}` : '$0'} mono />
        {trade.bot_name && <Row label="Bot" value={`${trade.bot_name} ${trade.bot_version ?? ''}`.trim()} />}
      </div>

      {/* Notes */}
      {(trade.entry_reason || trade.exit_reason || trade.mistake_notes || trade.lesson_learned) && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
          <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Catatan</h3>
          {trade.entry_reason && <div><p className="text-gray-500 text-xs mb-1">Alasan Entry</p><p className="text-gray-300 text-sm">{trade.entry_reason}</p></div>}
          {trade.exit_reason && <div><p className="text-gray-500 text-xs mb-1">Alasan Exit</p><p className="text-gray-300 text-sm">{trade.exit_reason}</p></div>}
          {trade.mistake_notes && <div><p className="text-gray-500 text-xs mb-1">Kesalahan</p><p className="text-red-300 text-sm">{trade.mistake_notes}</p></div>}
          {trade.lesson_learned && <div><p className="text-gray-500 text-xs mb-1">Pelajaran</p><p className="text-emerald-300 text-sm">{trade.lesson_learned}</p></div>}
        </div>
      )}

      {/* Psychology */}
      {psych && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Psychology</h3>
          <Row label="Emosi Sebelum Entry" value={psych.emotion_before} />
          <Row label="Skor Disiplin" value={psych.discipline_score ? `${psych.discipline_score}/10` : null} />
          <Row label="Kualitas Setup" value={psych.setup_quality_score ? `${psych.setup_quality_score}/10` : null} />
          <Row label="Sesuai Plan Entry" value={psych.followed_plan_entry !== null ? (psych.followed_plan_entry ? 'Ya Ya' : 'Tidak Tidak') : null} />
          <Row label="Sesuai Plan Exit" value={psych.followed_plan_exit !== null ? (psych.followed_plan_exit ? 'Ya Ya' : 'Tidak Tidak') : null} />
          <Row label="Revenge Trade" value={psych.revenge_trade ? 'Ya' : 'Tidak'} />
          <Row label="Oversized" value={psych.oversized ? 'Ya' : 'Tidak'} />
          {psych.notes && <div className="pt-2"><p className="text-gray-500 text-xs mb-1">Catatan</p><p className="text-gray-300 text-sm">{psych.notes}</p></div>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Link href="/trades" className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-3 rounded-xl text-sm font-medium transition-colors text-center">
          ← Kembali
        </Link>
        <Link href={`/trades/${id}/edit`} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-colors text-center">
          Edit Trade
        </Link>
        <button onClick={handleDelete} className="px-4 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 py-3 rounded-xl text-sm font-medium transition-colors">
          Hapus
        </button>
      </div>
    </div>
  )
}
