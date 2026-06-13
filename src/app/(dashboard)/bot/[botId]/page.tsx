'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Trade } from '@/types/trade'
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Icons } from '@/components/ui/Icons'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type BotConfig = { id:string; name:string; version:string|null; mode:string; exchange:string|null; strategy:string|null; notes:string|null; is_active:boolean; created_at:string }
const CS = { background:'#1a1a2a', border:'1px solid #2a2a3a', borderRadius:8, fontSize:12 }

function StatCard({ label, value, sub, color='default' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const border: Record<string,string> = { default:'border-[#2a2a3a] bg-[#14141e]', green:'border-emerald-900/40 bg-emerald-950/30', red:'border-red-900/40 bg-red-950/30', blue:'border-blue-900/40 bg-blue-950/30', gold:'border-amber-900/40 bg-amber-950/30' }
  const text: Record<string,string> = { default:'text-white', green:'text-emerald-400', red:'text-red-400', blue:'text-blue-400', gold:'text-amber-400' }
  return <div className={`rounded-xl border p-4 ${border[color]}`}><p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p><p className={`text-xl font-bold font-mono ${text[color]}`}>{value}</p>{sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}</div>
}

export default function BotDetailPage() {
  const { botId } = useParams<{ botId:string }>()
  const router = useRouter()
  const [bot,setBot] = useState<BotConfig|null>(null)
  const [trades,setTrades] = useState<Trade[]>([])
  const [loading,setLoading] = useState(true)
  const [deleteOpen,setDeleteOpen] = useState(false)
  const [deleting,setDeleting] = useState(false)

  useEffect(() => { async function load() {
    const supabase = createClient()
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data:b },{ data:t }] = await Promise.all([
      supabase.from('bot_configs').select('*').eq('id',botId).single(),
      supabase.from('trades').select('*').eq('user_id',user.id).eq('bot_id',botId).order('entry_at',{ ascending:true }),
    ])
    let botTrades = t ?? []
    if (!botTrades.length && b) {
      const { data:byName } = await supabase.from('trades').select('*').eq('user_id',user.id).eq('bot_name',b.name).order('entry_at',{ ascending:true })
      botTrades = byName ?? []
    }
    setBot(b); setTrades(botTrades); setLoading(false)
  } load() },[botId])

  const stats = useMemo(() => {
    const wins=trades.filter(t=>t.result==='win'), losses=trades.filter(t=>t.result==='loss')
    const netPnl=trades.reduce((s,t)=>s+(t.net_pnl??0),0), totalFee=trades.reduce((s,t)=>s+(t.fee??0),0)
    const winRate=trades.length?wins.length/trades.length*100:0
    const avgWin=wins.length?wins.reduce((s,t)=>s+(t.net_pnl??0),0)/wins.length:0
    const avgLoss=losses.length?Math.abs(losses.reduce((s,t)=>s+(t.net_pnl??0),0)/losses.length):0
    const profitFactor=avgLoss>0?(avgWin*wins.length)/(avgLoss*losses.length):Infinity
    let peak=0,eq=0,maxDD=0
    for (const t of trades) { eq+=(t.net_pnl??0); if(eq>peak)peak=eq; maxDD=Math.max(maxDD,peak-eq) }
    return { total:trades.length,wins:wins.length,losses:losses.length,winRate:winRate.toFixed(1),netPnl:netPnl.toFixed(2),totalFee:totalFee.toFixed(2),avgWin:avgWin.toFixed(2),avgLoss:avgLoss.toFixed(2),profitFactor:profitFactor===Infinity?'∞':profitFactor.toFixed(2),maxDrawdown:maxDD.toFixed(2) }
  },[trades])

  const equityCurve = useMemo(() => { let eq=0; return trades.map(t=>({ date:t.entry_at.slice(5,10), equity:parseFloat((eq+=(t.net_pnl??0)).toFixed(2)) })) },[trades])
  const dailyPnl = useMemo(() => { const map:Record<string,number>={}; trades.forEach(t=>{ const d=t.entry_at.slice(0,10); map[d]=(map[d]??0)+(t.net_pnl??0) }); return Object.entries(map).map(([date,pnl])=>({ date:date.slice(5),pnl:parseFloat(pnl.toFixed(2)) })) },[trades])

  async function handleDelete() {
    setDeleting(true)
    const { error } = await createClient().from('bot_configs').delete().eq('id',botId)
    if (error) { toast.error('Gagal menghapus bot'); setDeleting(false); return }
    setDeleteOpen(false); toast.success('Bot dihapus'); router.push('/bot')
  }

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>
  if (!bot) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Bot tidak ditemukan</p></div>

  return <div className="max-w-3xl mx-auto p-6 space-y-5">
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={handleDelete} loading={deleting} title="Hapus bot?" description={<>Bot <strong className="text-gray-200">{bot.name}</strong> akan dihapus. Trade yang terhubung tetap tersimpan di jurnal.</>} confirmLabel="Hapus Bot" />
    <div className="flex items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 flex-wrap"><h1 className="text-white font-bold text-xl">{bot.name}</h1>{bot.version&&<span className="text-xs bg-[#1e1e2e] text-gray-400 px-2 py-1 rounded-lg">{bot.version}</span>}<span className={`text-xs px-2 py-1 rounded-lg font-bold ${bot.mode==='live'?'bg-emerald-500/20 text-emerald-400':'bg-gray-500/20 text-gray-400'}`}>{bot.mode.toUpperCase()}</span></div><p className="text-gray-500 text-xs mt-1">{bot.exchange??'—'} · {bot.strategy??'—'} · Dibuat {new Date(bot.created_at).toLocaleDateString('id-ID')}</p>{bot.notes&&<p className="text-gray-400 text-sm mt-2">{bot.notes}</p>}</div>
      <button onClick={()=>setDeleteOpen(true)} disabled={deleting} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 text-xs rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"><Icons.Trash/> Hapus</button>
    </div>
    {trades.length===0 ? <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl flex flex-col items-center py-12 gap-3"><Icons.EmptyTrades/><p className="text-gray-400 text-sm">Bot ini belum punya trade tercatat</p><Link href="/trades/new" className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors"><Icons.Plus/> Tambah Trade Bot</Link></div> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><StatCard label="Net P/L" value={`${Number(stats.netPnl)>=0?'+':''}$${stats.netPnl}`} color={Number(stats.netPnl)>=0?'green':'red'}/><StatCard label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.wins}W / ${stats.losses}L`} color="blue"/><StatCard label="Profit Factor" value={stats.profitFactor} color="gold"/><StatCard label="Total Trades" value={stats.total} sub={`Fee: $${stats.totalFee}`}/></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><StatCard label="Avg Win" value={`+$${stats.avgWin}`} color="green"/><StatCard label="Avg Loss" value={`-$${stats.avgLoss}`} color="red"/><StatCard label="Max Drawdown" value={`-$${stats.maxDrawdown}`} color="red"/><StatCard label="Total Fee" value={`$${stats.totalFee}`}/></div>
      {equityCurve.length>1&&<div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4"><h3 className="text-gray-300 text-sm font-semibold mb-4">Equity Curve Bot</h3><ResponsiveContainer width="100%" height={160}><LineChart data={equityCurve}><CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e"/><XAxis dataKey="date" stroke="#4b5563" tick={{fontSize:10}}/><YAxis stroke="#4b5563" tick={{fontSize:10}} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={CS}/><Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Equity ($)"/></LineChart></ResponsiveContainer></div>}
      {dailyPnl.length>0&&<div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl p-4"><h3 className="text-gray-300 text-sm font-semibold mb-4">Daily P/L</h3><ResponsiveContainer width="100%" height={140}><BarChart data={dailyPnl}><CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e"/><XAxis dataKey="date" stroke="#4b5563" tick={{fontSize:10}}/><YAxis stroke="#4b5563" tick={{fontSize:10}} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={CS}/><Bar dataKey="pnl" name="Net P/L" radius={[4,4,0,0]}>{dailyPnl.map((d,i)=><Cell key={i} fill={d.pnl>=0?'#10b981':'#ef4444'}/>)}</Bar></BarChart></ResponsiveContainer></div>}
      <div className="bg-[#14141e] border border-[#2a2a3a] rounded-xl overflow-hidden"><div className="px-4 py-3 border-b border-[#2a2a3a]"><h3 className="text-gray-300 text-sm font-semibold">Trades Bot ({trades.length})</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[#2a2a3a]">{['Tanggal','Pair','Side','TF','Entry','Exit','P/L','Hasil'].map(h=><th key={h} className="text-left text-gray-400 text-xs font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#1e1e2e]">{[...trades].reverse().map(t=><tr key={t.id} className="hover:bg-[#1a1a2a] transition-colors cursor-pointer" onClick={()=>router.push(`/trades/${t.id}`)}><td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{new Date(t.entry_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</td><td className="px-4 py-2.5 text-gray-100 text-xs font-medium">{t.symbol}</td><td className="px-4 py-2.5 whitespace-nowrap"><span className={`text-xs font-bold ${t.position_type==='long'?'text-emerald-400':'text-red-400'}`}>{t.position_type?.toUpperCase()}</span></td><td className="px-4 py-2.5 text-gray-500 text-xs">{t.timeframe??'—'}</td><td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{Number(t.entry_price).toLocaleString()}</td><td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{t.exit_price?Number(t.exit_price).toLocaleString():'—'}</td><td className={`px-4 py-2.5 font-bold font-mono text-xs ${(t.net_pnl??0)>=0?'text-emerald-400':'text-red-400'}`}>{(t.net_pnl??0)>=0?'+':''}{t.net_pnl??0}</td><td className="px-4 py-2.5">{t.result==='win'?<span className="text-xs font-bold text-emerald-400">WIN</span>:t.result==='loss'?<span className="text-xs font-bold text-red-400">LOSS</span>:t.result?<span className="text-xs text-gray-400">BE</span>:<span className="text-gray-600 text-xs">—</span>}</td></tr>)}</tbody></table></div></div>
    </>}
    <Link href="/bot" className="flex items-center gap-2 text-gray-400 hover:text-white text-xs transition-colors pb-4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Kembali ke Bot Journal</Link>
  </div>
}
