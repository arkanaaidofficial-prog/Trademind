'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { parseCsvToTrades, generateCsvTemplate, downloadFile } from '@/lib/importExport'
import { toast } from 'sonner'
import { Icons } from '@/components/ui/Icons'

type ParsedRow = {
  symbol: string
  position_type: string
  entry_at: string
  entry_price: number
  net_pnl?: number
  result?: string
  strategy_name?: string
  mode?: string
  [key: string]: unknown
}

type ImportError = { row: number; message: string }

export default function ImportPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step,     setStep]     = useState<'upload' | 'preview' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [preview,  setPreview]  = useState<ParsedRow[]>([])
  const [errors,   setErrors]   = useState<ImportError[]>([])
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(0)

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { toast.error('File harus berformat CSV'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      // preview parse — userId placeholder, will be replaced on actual import
      const { trades, errors } = parseCsvToTrades(text, 'preview')
      setPreview(trades as ParsedRow[])
      setErrors(errors)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Tidak terautentikasi'); setImporting(false); return }

    // Re-parse with real userId
    const fileInput = fileRef.current
    if (!fileInput?.files?.[0]) { setImporting(false); return }

    const text = await fileInput.files[0].text()
    const { trades: parsedTrades, errors: parseErrors } = parseCsvToTrades(text, user.id)

    if (parsedTrades.length === 0) {
      toast.error('Tidak ada trade valid untuk diimport')
      setImporting(false)
      return
    }

    // Batch insert in chunks of 50
    const CHUNK = 50
    let successCount = 0
    const insertErrors: ImportError[] = []

    for (let i = 0; i < parsedTrades.length; i += CHUNK) {
      const chunk = parsedTrades.slice(i, i + CHUNK)
      const { error } = await supabase.from('trades').insert(chunk)
      if (error) {
        insertErrors.push({ row: i + 1, message: error.message })
      } else {
        successCount += chunk.length
      }
    }

    // Log import
    await supabase.from('imports').insert({
      user_id:      user.id,
      filename:     fileName,
      source:       'csv',
      rows_total:   parsedTrades.length + parseErrors.length,
      rows_success: successCount,
      rows_failed:  parseErrors.length + insertErrors.length,
      errors:       [...parseErrors, ...insertErrors],
    })

    setImported(successCount)
    setImporting(false)
    setStep('done')

    if (successCount > 0) toast.success(`${successCount} trade berhasil diimport!`)
    if (insertErrors.length > 0) toast.error(`${insertErrors.length} baris gagal diinsert`)
  }

  function downloadTemplate() {
    downloadFile(generateCsvTemplate(), 'trademind-template.csv')
    toast.success('Template CSV didownload!')
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">Import CSV</h1>
          <p className="text-gray-400 text-xs mt-0.5">Upload file CSV untuk import trade secara massal</p>
        </div>
        <Link href="/trades" className="flex items-center gap-2 text-gray-400 hover:text-white text-xs transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Kembali
        </Link>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['upload','preview','done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === s ? 'bg-blue-600 text-white' :
              ['upload','preview','done'].indexOf(step) > i ? 'bg-emerald-600 text-white' :
              'bg-[#1e1e2e] text-gray-500'
            }`}>
              {['upload','preview','done'].indexOf(step) > i
                ? <Icons.Check />
                : i + 1}
            </div>
            <span className={`text-xs ${step === s ? 'text-white font-medium' : 'text-gray-500'}`}>
              {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Selesai'}
            </span>
            {i < 2 && <div className={`w-8 h-px ${['upload','preview','done'].indexOf(step) > i ? 'bg-emerald-600' : 'bg-[#2a2a3a]'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Template download */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="text-blue-400 mt-0.5 flex-shrink-0"><Icons.Idea /></div>
            <div className="flex-1">
              <p className="text-blue-300 text-xs font-medium">Belum punya template CSV?</p>
              <p className="text-gray-400 text-xs mt-0.5">Download template dengan format yang benar, isi data trade kamu, lalu upload kembali.</p>
            </div>
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-blue-300 text-xs px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              <Icons.Download /> Template
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-[#2a2a3a] hover:border-blue-500/50 hover:bg-[#14141e]'
            }`}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#1e1e2e] flex items-center justify-center text-gray-400">
                <Icons.Upload />
              </div>
              <div>
                <p className="text-gray-200 text-sm font-medium">Drag & drop file CSV ke sini</p>
                <p className="text-gray-500 text-xs mt-1">atau klik untuk memilih file</p>
              </div>
              <span className="text-xs text-gray-600 bg-[#1e1e2e] px-3 py-1 rounded-full">Format: .csv • Max 5MB</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {/* Format guide */}
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4">
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Kolom yang Didukung</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['symbol*','position_type*','entry_at*','entry_price*','exit_price','net_pnl',
                'result','strategy_name','setup_type','timeframe','mode','fee',
                'stop_loss','take_profit','risk_percent','market_condition',
                'entry_reason','mistake_notes','bot_name','tags'].map(col => (
                <div key={col} className={`text-xs px-2 py-1 rounded font-mono ${
                  col.endsWith('*')
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-[#1e1e2e] text-gray-400'
                }`}>{col}</div>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-2">* = wajib diisi</p>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#1e1e2e] rounded-lg px-3 py-1.5">
                <span className="text-gray-300 text-xs font-medium">{fileName}</span>
              </div>
              <span className="text-emerald-400 text-xs font-bold">{preview.length} valid</span>
              {errors.length > 0 && <span className="text-red-400 text-xs font-bold">{errors.length} error</span>}
            </div>
            <button onClick={() => { setStep('upload'); setPreview([]); setErrors([]) }}
              className="text-gray-400 hover:text-white text-xs transition-colors">
              Ganti File
            </button>
          </div>

          {/* Error list */}
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-xs font-semibold mb-2">Baris yang Tidak Valid (akan dilewati)</p>
              <div className="space-y-1 max-h-32 overflow-auto">
                {errors.map((e, i) => (
                  <p key={i} className="text-red-300 text-xs font-mono">Row {e.row}: {e.message}</p>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
              <h3 className="text-gray-300 text-sm font-semibold">Preview Data ({Math.min(preview.length, 5)} dari {preview.length} baris)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    {['Symbol','Side','Tanggal Entry','Entry Price','Net P/L','Result','Strategy','Mode'].map(h => (
                      <th key={h} className="text-left text-gray-500 font-medium px-4 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {preview.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-[#1a1a2a]">
                      <td className="px-4 py-2 text-gray-100 font-medium">{row.symbol}</td>
                      <td className="px-4 py-2">
                        <span className={`font-bold ${row.position_type === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {String(row.position_type).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                        {new Date(row.entry_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-2 text-gray-300 font-mono">{Number(row.entry_price).toLocaleString()}</td>
                      <td className={`px-4 py-2 font-mono font-bold ${(Number(row.net_pnl) ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.net_pnl != null ? `${Number(row.net_pnl) >= 0 ? '+' : ''}${row.net_pnl}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-400">{String(row.result ?? '—')}</td>
                      <td className="px-4 py-2 text-gray-400 max-w-[100px] truncate">{String(row.strategy_name ?? '—')}</td>
                      <td className="px-4 py-2 text-gray-500">{String(row.mode ?? 'manual')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 5 && (
              <div className="px-4 py-2 border-t border-[#1e1e2e]">
                <p className="text-gray-500 text-xs">... dan {preview.length - 5} baris lainnya</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep('upload'); setPreview([]); setErrors([]) }}
              className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-3 rounded-xl text-sm font-medium transition-colors">
              Batal
            </button>
            <button onClick={handleImport} disabled={importing || preview.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors">
              {importing
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mengimport...</>
                : <><Icons.Upload /> Import {preview.length} Trade</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-8 h-8">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Import Berhasil!</h2>
            <p className="text-gray-400 text-sm mt-1">
              <span className="text-emerald-400 font-bold">{imported} trade</span> berhasil ditambahkan ke jurnal kamu.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setPreview([]); setErrors([]); setImported(0) }}
              className="bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Import Lagi
            </button>
            <button onClick={() => router.push('/trades')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
              Lihat Trades
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
