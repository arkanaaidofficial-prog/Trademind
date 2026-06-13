'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseCsvToTrades, generateCsvTemplate, downloadFile } from '@/lib/importExport'
import { toast } from 'sonner'

type ImportError = { row: number; message: string }
type ImportResult = { total: number; success: number; errors: ImportError[] }

const UploadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-gray-500"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const FileIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-blue-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
const XIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-red-400"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ReturnType<typeof parseCsvToTrades> | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleDownloadTemplate() {
    downloadFile(generateCsvTemplate(), 'trademind-import-template.csv')
    toast.success('Template CSV berhasil didownload')
  }

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.csv')) { toast.error('Hanya file CSV yang didukung'); return }
    setFile(f)
    setResult(null)
    const text = await f.text()
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      toast.error('Gagal membaca user aktif')
      setPreview(null)
      return
    }
    const parsed = parseCsvToTrades(text, user.id)
    setPreview(parsed)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleImport() {
    if (!preview || preview.trades.length === 0) return
    setImporting(true)
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      toast.error('Gagal membaca user aktif')
      setImporting(false)
      return
    }

    let success = 0
    const errors: ImportError[] = [...preview.errors]

    for (let i = 0; i < preview.trades.length; i++) {
      const { error } = await supabase.from('trades').insert({ ...preview.trades[i], user_id: user.id })
      if (error) {
        errors.push({ row: i + 2, message: error.message })
      } else {
        success++
      }
    }

    setResult({ total: preview.trades.length + preview.errors.length, success, errors })
    setImporting(false)
    if (success > 0) toast.success(`${success} trade berhasil diimport!`)
    if (errors.length > 0) toast.error(`${errors.length} baris gagal diimport`)
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-white font-bold text-lg">Import CSV</h1>
        <p className="text-gray-400 text-xs mt-0.5">Upload file CSV untuk import trade secara bulk</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-blue-400 text-sm font-medium">Download Template CSV</p>
              <p className="text-gray-400 text-xs mt-0.5">Gunakan template ini agar format sesuai dengan sistem TradeMind</p>
            </div>
            <button type="button" onClick={handleDownloadTemplate}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
              Download Template
            </button>
          </div>

          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-500 bg-blue-500/10' : file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-[#2a2a3a] hover:border-blue-500/50 hover:bg-[#1a1a2a]'
              }`}>
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileIcon />
                  <p className="text-gray-200 text-sm font-medium">{file.name}</p>
                  <p className="text-gray-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                  <p className="text-blue-400 text-xs">Klik untuk ganti file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <UploadIcon />
                  <p className="text-gray-300 text-sm font-medium">Drag & drop file CSV di sini</p>
                  <p className="text-gray-500 text-xs">atau klik untuk pilih file</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {preview && !result && (
            <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-gray-200 font-semibold text-sm">Preview Import</h3>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 text-xs font-medium">{preview.trades.length} valid</span>
                  {preview.errors.length > 0 && <span className="text-red-400 text-xs font-medium">{preview.errors.length} error</span>}
                </div>
              </div>

              {preview.trades.length > 0 && (
                <div className="divide-y divide-[#1e1e2e] max-h-64 overflow-y-auto">
                  {preview.trades.slice(0, 12).map((t, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <CheckIcon />
                      <span className="text-gray-200 text-xs font-medium w-24">{t.symbol}</span>
                      <span className={`text-xs ${t.position_type === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>{t.position_type === 'long' ? 'BUY/LONG' : 'SELL/SHORT'}</span>
                      <span className="text-gray-500 text-xs">{t.entry_at?.slice(0, 10)}</span>
                      <span className={`text-xs font-mono ml-auto ${(t.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.net_pnl !== undefined ? `${t.net_pnl >= 0 ? '+' : ''}$${t.net_pnl}` : '-'}
                      </span>
                    </div>
                  ))}
                  {preview.trades.length > 12 && (
                    <div className="px-4 py-2 text-gray-500 text-xs">...dan {preview.trades.length - 12} trade lainnya</div>
                  )}
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="border-t border-[#2a2a3a]">
                  <p className="text-red-400 text-xs font-medium px-4 py-2">Baris dengan error (tidak akan diimport):</p>
                  <div className="divide-y divide-[#1e1e2e] max-h-40 overflow-y-auto">
                    {preview.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-2">
                        <XIcon />
                        <span className="text-gray-500 text-xs">Baris {err.row}:</span>
                        <span className="text-red-300 text-xs">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 py-3 border-t border-[#2a2a3a] flex gap-3">
                <button type="button" onClick={() => { setFile(null); setPreview(null) }}
                  className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Batal
                </button>
                <button type="button" onClick={handleImport} disabled={importing || preview.trades.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-bold transition-colors">
                  {importing ? 'Mengimport...' : `Import ${preview.trades.length} Trade`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 space-y-4">
              <h3 className="text-gray-200 font-semibold text-sm">Hasil Import</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1a1a2a] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{result.total}</p>
                  <p className="text-gray-500 text-xs mt-1">Total Baris</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.success}</p>
                  <p className="text-gray-500 text-xs mt-1">Berhasil</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{result.errors.length}</p>
                  <p className="text-gray-500 text-xs mt-1">Gagal</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-red-400 text-xs font-medium">Detail Error:</p>
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-gray-500">Baris {e.row}:</span>
                      <span className="text-red-300">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setFile(null); setPreview(null); setResult(null) }}
                  className="flex-1 bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Import Lagi
                </button>
                <button type="button" onClick={() => router.push('/trades')}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-bold transition-colors">
                  Lihat Trades
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
          <h3 className="text-gray-300 text-sm font-semibold">Panduan Import</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <p>1. Download template CSV di atas</p>
            <p>2. Isi data trade sesuai format kolom yang ada</p>
            <p>3. Field wajib: <span className="text-gray-200">symbol, entry_at, entry_price, position_type</span></p>
            <p>4. Format tanggal: <span className="text-gray-200 font-mono">2025-06-07 09:00</span></p>
            <p>5. position_type: <span className="text-gray-200">long</span> atau <span className="text-gray-200">short</span></p>
            <p>6. result: <span className="text-gray-200">win</span>, <span className="text-gray-200">loss</span>, atau <span className="text-gray-200">breakeven</span></p>
            <p>7. Upload file CSV dan review sebelum import</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
