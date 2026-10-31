'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import type { Trade } from '@/types/trade'
import { calcPerformanceByDimension } from '@/lib/calculations/stats'
import { kelompokPerHari, kelompokPerJam, kurvaEkuitasR, zonaWaktuBawaan } from '@/lib/calculations/analytics'
import { calcStatistikEkskursi, AMBANG_MAE_MENANG, AMBANG_EFISIENSI } from '@/lib/calculations/ekskursi'

type Psych = {
  trade_id: string
  emotion_before: string | null
  discipline_score: number | null
  setup_quality_score: number | null
  followed_plan_entry: boolean | null
  followed_plan_exit: boolean | null
  revenge_trade: boolean | null
  oversized: boolean | null
}

type Dim = { label: string; trades: number; wins: number; net_pnl: number; win_rate: number; avg_r: number | null }
type HourDim = ReturnType<typeof kelompokPerJam>[number]

// Pengelompokan dimensi memakai calcPerformanceByDimension yang sudah
// diuji: pembagi win_rate adalah trade SELESAI, dan avg_r ikut terbawa
// supaya trade bot (yang tidak punya nominal) tetap terbaca.
function groupBy(trades: Trade[], key: keyof Trade): Dim[] {
  return calcPerformanceByDimension(trades, t => String(t[key] ?? 'Unknown')).map(d => ({
    label: d.label,
    trades: d.total,
    wins: d.wins,
    net_pnl: d.net_pnl,
    win_rate: Math.round(d.win_rate),
    avg_r: d.avg_r,
  }))
}

const CT = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {p.name}: {p.name.includes('%') ? `${p.value}%` : `$${p.value}`}
        </p>
      ))}
    </div>
  )
}

function DimTable({ data }: { data: Dim[] }) {
  if (!data.length) return <p className="text-gray-500 text-sm text-center py-8">Tidak ada data</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a3a]">
            {['Label', 'Trades', 'Win Rate', 'Avg R', 'Net P/L'].map(h => (
              <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e2e]">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
              <td className="px-4 py-3 text-gray-200 text-xs font-medium">{d.label}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
              <td className={`px-4 py-3 text-xs font-bold ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</td>
              <td className={`px-4 py-3 text-xs font-bold font-mono ${d.avg_r === null ? 'text-gray-600' : d.avg_r >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {d.avg_r === null ? '—' : `${d.avg_r >= 0 ? '+' : ''}${d.avg_r.toFixed(2)}R`}
              </td>
              <td className={`px-4 py-3 text-xs font-bold font-mono ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TABS = [
  { key: 'pair', label: 'Per Pair' },
  { key: 'strategy', label: 'Strategi' },
  { key: 'timeframe', label: 'Timeframe' },
  { key: 'condition', label: 'Kondisi Pasar' },
  { key: 'emotion', label: 'Emosi' },
  { key: 'day', label: 'Per Hari' },
  { key: 'hour', label: 'Per Jam' },
  { key: 'mode', label: 'Manual vs Bot' },
] as const
type Tab = typeof TABS[number]['key']

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [psychData, setPsychData] = useState<Psych[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pair')
  // Zona profil, bukan zona peramban: tanggal dan jam harus memakai
  // kalender yang sama di seluruh halaman ini.
  const [zona, setZona] = useState<string>(() => zonaWaktuBawaan(null))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const [{ data: t }, { data: p }, { data: prof }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', data.user.id).order('entry_at', { ascending: true }),
        supabase.from('trade_psychology').select('*').eq('user_id', data.user.id),
        supabase.from('profiles').select('timezone').eq('id', data.user.id).maybeSingle(),
      ])
      setTrades(t ?? [])
      setPsychData(p ?? [])
      setZona(zonaWaktuBawaan(prof?.timezone))
      setLoading(false)
    })
  }, [])

  const dimData = useMemo(() => {
    if (['pair','strategy','timeframe','condition','mode'].includes(tab)) {
      const keyMap: Record<string, keyof Trade> = {
        pair: 'symbol', strategy: 'strategy_name',
        timeframe: 'timeframe', condition: 'market_condition', mode: 'mode',
      }
      return groupBy(trades, keyMap[tab])
    }
    return []
  }, [trades, tab])

  const dayData = useMemo(() => kelompokPerHari(trades, zona), [trades, zona])
  const hourData = useMemo(() => kelompokPerJam(trades, zona), [trades, zona])
  const kurvaR = useMemo(() => kurvaEkuitasR(trades, zona), [trades, zona])
  const eks = useMemo(() => calcStatistikEkskursi(trades), [trades])

  // Emotion analytics - join trades + psychology
  const emotionData = useMemo(() => {
    if (tab !== 'emotion') return []
    const psychMap = new Map(psychData.map(p => [p.trade_id, p]))
    const byEmotion = new Map<string, { trades: Trade[]; discipline: number[] }>()
    for (const t of trades) {
      const p = psychMap.get(t.id)
      if (!p?.emotion_before) continue
      const e = p.emotion_before
      if (!byEmotion.has(e)) byEmotion.set(e, { trades: [], discipline: [] })
      byEmotion.get(e)!.trades.push(t)
      if (p.discipline_score) byEmotion.get(e)!.discipline.push(p.discipline_score)
    }
    return Array.from(byEmotion.entries()).map(([emotion, v]) => {
      const wins = v.trades.filter(t => t.result === 'win').length
      const selesai = v.trades.filter(t => t.result !== undefined && t.result !== null).length
      const net_pnl = Math.round(v.trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0) * 100) / 100
      const avg_discipline = v.discipline.length
        ? Math.round(v.discipline.reduce((s, d) => s + d, 0) / v.discipline.length * 10) / 10
        : null
      return {
        label: emotion,
        trades: v.trades.length,
        wins,
        net_pnl,
        win_rate: selesai > 0 ? Math.round((wins / selesai) * 100) : 0,
        avg_discipline,
      }
    }).sort((a, b) => b.net_pnl - a.net_pnl)
  }, [trades, psychData, tab])

  // Discipline vs PnL correlation
  const disciplineCorr = useMemo(() => {
    if (tab !== 'emotion') return []
    return psychData
      .map(p => {
        const t = trades.find(t => t.id === p.trade_id)
        if (!t || p.discipline_score === null) return null
        return { discipline: p.discipline_score, pnl: t.net_pnl ?? 0, symbol: t.symbol }
      })
      .filter(Boolean) as { discipline: number; pnl: number; symbol: string }[]
  }, [trades, psychData, tab])

  const equityCurve = useMemo(() => {
    // Hanya trade yang P/L-nya benar-benar ada, diurutkan pada waktu
    // KELUAR. Versi lama memasukkan posisi terbuka sebagai titik datar
    // dan mengurutkan pada waktu masuk.
    let eq = 0
    return trades
      .filter(t => t.net_pnl !== undefined && t.net_pnl !== null)
      .slice()
      .sort((a, b) =>
        new Date(a.exit_at ?? a.entry_at).getTime() - new Date(b.exit_at ?? b.entry_at).getTime())
      .map(t => {
        eq += (t.net_pnl ?? 0)
        return { date: (t.exit_at ?? t.entry_at).slice(0, 10), equity: Math.round(eq * 100) / 100 }
      })
  }, [trades])

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat analytics...</p></div>

  if (!trades.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-gray-600">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      <h2 className="text-white font-bold text-xl">Belum ada data</h2>
      <p className="text-gray-400 text-sm">Tambahkan beberapa trade untuk melihat analytics.</p>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-white font-bold text-lg">Analytics</h1>
        <p className="text-gray-400 text-xs mt-0.5">
          {trades.length} trades · {psychData.length} psychology records · tanggal &amp; jam dalam {zona}
        </p>
      </div>

      {/* Equity curve */}
      {equityCurve.length > 1 && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityCurve}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CT />} />
              <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Equity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kurva R — kurva ekuitas untuk trade yang tidak punya nominal
          sama sekali, mis. kiriman bot-futures. */}
      {kurvaR.length > 1 && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-gray-300 text-sm font-semibold">Kurva R Kumulatif</h3>
            <span className="text-gray-500 text-xs">
              {kurvaR.length} trade ber-R · total {kurvaR[kurvaR.length - 1].r >= 0 ? '+' : ''}
              {kurvaR[kurvaR.length - 1].r.toFixed(2)}R
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={kurvaR}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}R`} />
              <Tooltip content={<CT />} />
              <Line type="monotone" dataKey="r" stroke="#a855f7" strokeWidth={2} dot={false} name="R kumulatif" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MAE / MFE — dua pertanyaan yang tidak bisa dijawab angka lain */}
      {(eks.trades_dengan_mae > 0 || eks.trades_dengan_mfe > 0) && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-gray-300 text-sm font-semibold">MAE / MFE</h3>
            <span className="text-gray-500 text-xs">
              {eks.trades_dengan_mae} trade punya MAE · {eks.trades_dengan_mfe} punya MFE
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: 'MAE rata (menang)', v: eks.mae_rata_menang, s: 'seberapa dalam kemenangan sempat tertekan' },
              { l: 'MAE p90 (menang)', v: eks.mae_p90_menang, s: '9 dari 10 kemenangan tertekan kurang dari ini' },
              { l: 'MFE rata', v: eks.mfe_rata, s: 'gerakan yang sempat tersedia' },
              { l: 'MFE rata (kalah)', v: eks.mfe_rata_kalah, s: 'kekalahan yang sempat untung' },
            ].map(k => (
              <div key={k.l} className="bg-[#0e0e18] border border-[#1e1e2e] rounded-xl p-3">
                <p className="text-gray-500 text-[10px] uppercase tracking-wide">{k.l}</p>
                <p className="text-white text-lg font-bold font-mono mt-1">
                  {k.v === null ? '—' : `${k.v.toFixed(2)}R`}
                </p>
                <p className="text-gray-600 text-[10px] mt-1 leading-snug">{k.s}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Vonis TIGA keadaan: null = belum tahu, bukan aman. */}
            {[
              {
                judul: 'Apakah stop terlalu ketat?',
                vonis: eks.stop_terlalu_ketat,
                angka: eks.mae_rata_menang,
                ambang: AMBANG_MAE_MENANG,
                satuan: 'R',
                ya: `Kemenangan rata-rata tertekan ${eks.mae_rata_menang?.toFixed(2)}R sebelum berbalik. Stop yang sedikit lebih ketat akan membunuhnya sebelum sempat bekerja.`,
                tidak: `Kemenangan jarang tertekan dalam (rata ${eks.mae_rata_menang?.toFixed(2)}R). Stop sekarang punya kelonggaran.`,
              },
              {
                judul: 'Apakah keluar terlalu cepat?',
                vonis: eks.keluar_terlalu_cepat,
                angka: eks.efisiensi,
                ambang: AMBANG_EFISIENSI,
                satuan: '',
                ya: `Hanya ${eks.efisiensi !== null ? Math.round(eks.efisiensi * 100) : '—'}% dari gerakan yang tersedia berhasil ditangkap.`,
                tidak: `${eks.efisiensi !== null ? Math.round(eks.efisiensi * 100) : '—'}% dari gerakan yang tersedia tertangkap.`,
              },
            ].map(d => (
              <div key={d.judul} className={`rounded-xl border p-4 ${
                d.vonis === null ? 'border-[#2a2a3a] bg-[#0e0e18]'
                  : d.vonis ? 'border-amber-500/40 bg-amber-950/20'
                  : 'border-emerald-900/40 bg-emerald-950/20'}`}>
                <p className="text-gray-300 text-xs font-semibold mb-1">{d.judul}</p>
                {d.vonis === null ? (
                  <>
                    <p className="text-gray-400 text-sm font-bold">Belum bisa dijawab</p>
                    <p className="text-gray-600 text-[11px] mt-1 leading-snug">
                      Sampelnya belum cukup. Angkanya tetap ditampilkan di atas, tapi vonisnya ditahan —
                      &quot;belum tahu&quot; dan &quot;sudah diperiksa, aman&quot; adalah dua hal berbeda.
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-sm font-bold ${d.vonis ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {d.vonis ? 'YA' : 'Tidak'}
                    </p>
                    <p className="text-gray-400 text-[11px] mt-1 leading-snug">{d.vonis ? d.ya : d.tidak}</p>
                    <p className="text-gray-600 text-[10px] mt-1">
                      ambang {d.ambang}{d.satuan}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#0e0e18] border border-[#1e1e2e] rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden">

        {/* Dimension tabs */}
        {['pair','strategy','timeframe','condition','mode'].includes(tab) && (
          <>
            {dimData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dimData.slice(0, 10)}>
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="net_pnl" name="Net P/L" radius={[4,4,0,0]}>
                      {dimData.slice(0,10).map((d, i) => <Cell key={i} fill={d.net_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a]"><DimTable data={dimData} /></div>
          </>
        )}

        {/* Day tab */}
        {tab === 'day' && (
          <>
            {dayData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayData}>
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="pnl" name="Net P/L" radius={[4,4,0,0]}>
                      {dayData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Tanggal','Trades','Total R','Net P/L'].map(h => <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {dayData.map((d, i) => (
                    <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs">{d.date}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
                      <td className={`px-4 py-3 text-xs font-bold font-mono ${d.r === null ? 'text-gray-600' : d.r >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.r === null ? '—' : `${d.r >= 0 ? '+' : ''}${d.r.toFixed(2)}R`}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold font-mono ${d.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.pnl >= 0 ? '+' : ''}${d.pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Hour tab */}
        {tab === 'hour' && (
          <>
            {hourData.length > 0 && (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourData}>
                    <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="win_rate" name="Win Rate%" radius={[4,4,0,0]}>
                      {hourData.map((d, i) => <Cell key={i} fill={d.win_rate >= 50 ? '#3b82f6' : '#6b7280'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border-t border-[#2a2a3a] overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Jam','Trades','Selesai','Win Rate','Avg R','Net P/L'].map(h => <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {hourData.map((d, i) => (
                    <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs font-mono">{d.hour}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{d.selesai}</td>
                      <td className={`px-4 py-3 text-xs font-bold ${d.selesai === 0 ? 'text-gray-600' : d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.selesai === 0 ? '—' : `${d.win_rate}%`}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold font-mono ${d.avg_r === null ? 'text-gray-600' : d.avg_r >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.avg_r === null ? '—' : `${d.avg_r >= 0 ? '+' : ''}${d.avg_r.toFixed(2)}R`}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold font-mono ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Emotion tab */}
        {tab === 'emotion' && (
          <div className="space-y-0">
            {!psychData.length ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">Belum ada data psychology.</p>
                <p className="text-gray-500 text-xs mt-1">Isi emosi di setiap trade untuk melihat korelasi emosi dan performa.</p>
              </div>
            ) : (
              <>
                {emotionData.length > 0 && (
                  <div className="p-4">
                    <p className="text-gray-400 text-xs mb-3">Net P/L berdasarkan emosi sebelum entry</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={emotionData}>
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<CT />} />
                        <Bar dataKey="net_pnl" name="Net P/L" radius={[4,4,0,0]}>
                          {emotionData.map((d, i) => <Cell key={i} fill={d.net_pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="border-t border-[#2a2a3a] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#2a2a3a]">
                      {['Emosi','Trades','Win Rate','Net P/L','Avg Disiplin'].map(h => (
                        <th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-[#1e1e2e]">
                      {emotionData.map((d, i) => (
                        <tr key={i} className="hover:bg-[#1a1a2a] transition-colors">
                          <td className="px-4 py-3 text-gray-200 text-xs font-medium capitalize">{d.label}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{d.trades}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${d.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.win_rate}%</td>
                          <td className={`px-4 py-3 text-xs font-bold font-mono ${d.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {d.net_pnl >= 0 ? '+' : ''}${d.net_pnl}
                          </td>
                          <td className="px-4 py-3 text-xs text-blue-400 font-medium">
                            {d.avg_discipline ? `${d.avg_discipline}/10` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Discipline correlation */}
                {disciplineCorr.length > 0 && (
                  <div className="border-t border-[#2a2a3a] p-4">
                    <p className="text-gray-400 text-xs mb-3">Korelasi Skor Disiplin vs P/L</p>
                    <div className="grid grid-cols-5 gap-1">
                      {[1,2,3,4,5,6,7,8,9,10].map(score => {
                        const group = disciplineCorr.filter(d => d.discipline === score)
                        const avg = group.length ? group.reduce((s, d) => s + d.pnl, 0) / group.length : null
                        return (
                          <div key={score} className="text-center">
                            <div className={`h-12 rounded-lg flex items-end justify-center pb-1 text-xs font-bold ${
                              avg === null ? 'bg-[#1a1a2a]' : avg >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                            }`}>
                              {avg !== null ? (
                                <span className={avg >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {avg >= 0 ? '+' : ''}{Math.round(avg)}
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </div>
                            <p className="text-gray-500 text-[10px] mt-1">D{score}</p>
                            <p className="text-gray-600 text-[9px]">{group.length}x</p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-gray-600 text-xs mt-2">D1-D10 = Skor Disiplin. Angka = rata-rata P/L per trade</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
