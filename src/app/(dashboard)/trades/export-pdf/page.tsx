'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcDashboardStats } from '@/lib/calculations/stats'
import type { Trade } from '@/types/trade'
import { toast } from 'sonner'
import { Icons } from '@/components/ui/Icons'

function tradeSideLabel(trade: Trade) {
  const isSpot = (trade.trade_account_type ?? 'spot') === 'spot'
  if (isSpot) return trade.position_type === 'long' ? 'BUY' : 'SELL'
  return trade.position_type?.toUpperCase() ?? ''
}

function formatPnl(value?: number | null) {
  if (value === null || value === undefined) return '-'
  return `${value >= 0 ? '+' : ''}${value}`
}

export default function ExportPdfPage() {
  const router = useRouter()
  const [trades,    setTrades]    = useState<Trade[]>([])
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data, error: userError }) => {
      if (userError || !data.user) {
        if (userError) toast.error('Gagal membaca user aktif')
        setLoading(false)
        return
      }

      const { data: t, error } = await supabase.from('trades').select('*')
        .eq('user_id', data.user.id).order('entry_at', { ascending: true })

      if (error) {
        toast.error('Gagal memuat trade untuk PDF')
        setLoading(false)
        return
      }

      setTrades(t ?? [])
      if (t?.length) setDateFrom(t[0].entry_at.slice(0, 10))
      setLoading(false)
    })
  }, [])

  const filtered = trades.filter(t => {
    const d = t.entry_at.slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo   && d > dateTo)   return false
    return true
  })

  const stats = calcDashboardStats(filtered)

  async function handleExportPdf() {
    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()

      doc.setFillColor(14, 14, 24)
      doc.rect(0, 0, pageW, 35, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('TradeMind Journal', 14, 14)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 160, 180)
      doc.text('Trading Performance Report', 14, 21)
      doc.text(`Period: ${dateFrom || 'All'} to ${dateTo}`, 14, 27)
      doc.text(`Generated: ${new Date().toLocaleDateString('id-ID')}`, 14, 33)

      let y = 44
      doc.setTextColor(40, 40, 60)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Performance Summary', 14, y)
      y += 6

      const statItems = [
        ['Total Trades', String(stats.total_trades)],
        ['Win Rate',     `${stats.win_rate}%`],
        ['Net P/L',      `$${stats.net_pnl}`],
        ['Gross P/L',    `$${stats.gross_pnl}`],
        ['Total Fee',    `$${stats.total_fee}`],
        ['Profit Factor', String(stats.profit_factor)],
        ['Expectancy',   `$${stats.expectancy}`],
        ['Max Drawdown', `$${stats.max_drawdown}`],
        ['Avg Win',      `$${stats.avg_win}`],
        ['Avg Loss',     `$${stats.avg_loss}`],
        ['Best Trade',   `$${stats.best_trade_pnl}`],
        ['Worst Trade',  `$${stats.worst_trade_pnl}`],
      ]

      const colW = (pageW - 28) / 2
      statItems.forEach(([label, value], i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = 14 + col * colW
        const yy = y + row * 8
        doc.setFillColor(col % 2 === 0 ? 248 : 244, 248, 252)
        doc.roundedRect(x, yy - 4, colW - 2, 7, 1, 1, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 120)
        doc.text(label, x + 2, yy)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 50)
        doc.text(value, x + 2, yy + 3.5)
      })

      y += Math.ceil(statItems.length / 2) * 8 + 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 40, 60)
      doc.text(`Trade Log (${filtered.length} trades)`, 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [['Date', 'Pair', 'Side', 'Account', 'Entry', 'Exit', 'Net P/L', 'Result']],
        body: filtered.map(t => [
          t.entry_at.slice(0, 10),
          t.symbol,
          tradeSideLabel(t),
          t.trade_account_type ?? 'spot',
          Number(t.entry_price).toLocaleString(),
          t.exit_price ? Number(t.exit_price).toLocaleString() : '-',
          formatPnl(t.net_pnl),
          (t.result ?? 'open').toUpperCase(),
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 50], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        columnStyles: {
          0: { cellWidth: 18 }, 1: { cellWidth: 20 }, 2: { cellWidth: 14 },
          3: { cellWidth: 18 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 },
          6: { cellWidth: 18 }, 7: { cellWidth: 16 },
        },
      })

      const pageCount = (doc.internal as { getNumberOfPages(): number }).getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(150, 150, 170)
        doc.text(`TradeMind Journal - Page ${i} of ${pageCount}`, pageW / 2, 290, { align: 'center' })
      }

      doc.save(`trademind-report-${dateFrom || 'all'}-to-${dateTo}.pdf`)
      toast.success('PDF berhasil didownload!')
    } catch (err) {
      console.error(err)
      toast.error('Gagal generate PDF. Pastikan jspdf sudah terinstall.')
    }
    setExporting(false)
  }

  const inp = 'bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500'

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-white font-bold text-lg">Export PDF Report</h1>
          <p className="text-gray-400 text-xs">Generate laporan performa dalam format PDF</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        <div className="space-y-4">
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 space-y-4">
            <h2 className="text-gray-200 font-semibold text-sm">Pilih Periode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Dari Tanggal</label>
                <input type="date" className={inp + ' w-full'} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Sampai Tanggal</label>
                <input type="date" className={inp + ' w-full'} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <p className="text-amber-400 text-sm">Tidak ada trade di periode ini</p>
            </div>
          ) : (
            <button type="button" onClick={handleExportPdf} disabled={exporting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-lg text-sm font-bold transition-colors">
              {exporting
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating PDF...</>
                : <><Icons.Download /> Download PDF Report</>
              }
            </button>
          )}
        </div>

        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
          <h2 className="text-gray-200 font-semibold text-sm mb-4">Preview Laporan</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['Total Trades',  String(stats.total_trades),          ''],
              ['Win Rate',      `${stats.win_rate}%`,                stats.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'],
              ['Net P/L',       `${stats.net_pnl >= 0 ? '+' : ''}$${stats.net_pnl}`, stats.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'],
              ['Profit Factor', String(stats.profit_factor),         'text-amber-400'],
              ['Max Drawdown',  `-$${stats.max_drawdown}`,           'text-red-400'],
              ['Total Fee',     `$${stats.total_fee}`,               ''],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-[#1a1a2a] rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">{label}</p>
                <p className={`text-sm font-bold font-mono ${color || 'text-white'}`}>{value}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-3 text-center">{filtered.length} trades akan dimasukkan ke laporan</p>
        </div>
      </div>
    </div>
  )
}
