'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Archive, CheckCircle2, ExternalLink, Pencil, PlusCircle, RefreshCw, Search, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { CoinWatchlistItem, WatchMarketType, WatchPriority, WatchSourceType, WatchStatus } from '@/types/watchlist'
import { WATCH_PRIORITY_LABELS, WATCH_SOURCE_LABELS, WATCH_STATUS_LABELS } from '@/types/watchlist'

const sourceOptions = Object.entries(WATCH_SOURCE_LABELS) as Array<[WatchSourceType,string]>
const statusOptions = Object.entries(WATCH_STATUS_LABELS) as Array<[WatchStatus,string]>
const priorityOptions = Object.entries(WATCH_PRIORITY_LABELS) as Array<[WatchPriority,string]>
const marketOptions: Array<[WatchMarketType,string]> = [['crypto','Crypto'],['forex','Forex'],['saham','Saham'],['futures','Futures'],['other','Other']]

type WatchForm = { symbol:string; market_type:WatchMarketType; source_type:WatchSourceType; source_name:string; source_url:string; watch_status:WatchStatus; priority:WatchPriority; conviction_score:string; current_price:string; planned_entry:string; target_price:string; stop_loss:string; thesis:string; risk_notes:string; tags:string }
const EMPTY_FORM: WatchForm = { symbol:'',market_type:'crypto',source_type:'telegram',source_name:'',source_url:'',watch_status:'watching',priority:'medium',conviction_score:'5',current_price:'',planned_entry:'',target_price:'',stop_loss:'',thesis:'',risk_notes:'',tags:'' }

function isMissingTableError(error:{code?:string;message?:string}) { const message=error.message?.toLowerCase()??''; return error.code==='42P01'||message.includes('coin_watchlist')||message.includes('could not find the table') }
function normalizeUrl(value:string) { const raw=value.trim(); if(!raw)return null; try { const url=new URL(raw.startsWith('http://')||raw.startsWith('https://')?raw:`https://${raw}`); return url.protocol==='http:'||url.protocol==='https:'?url.toString():null } catch { return null } }
function numberOrNull(value:string) { const trimmed=value.trim(); if(!trimmed)return null; const parsed=Number(trimmed); return Number.isFinite(parsed)?parsed:null }
function parseTags(value:string) { return value.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,8) }
function formatPrice(value?:number|null) { return value===null||value===undefined?'-':`$${Number(value).toLocaleString('en-US',{maximumFractionDigits:8})}` }
function formatDate(value?:string|null) { return value?new Date(value).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}):'-' }
function priceUpside(item:CoinWatchlistItem) { const entry=Number(item.planned_entry??item.current_price??0),target=Number(item.target_price??0); return entry&&target?((target-entry)/entry)*100:null }
function buildTradeHref(item:CoinWatchlistItem) {
  const params=new URLSearchParams(); params.set('symbol',item.symbol); params.set('market_type',item.market_type); params.set('trade_account_type',item.market_type==='futures'?'futures':'spot'); params.set('mode','signal')
  const entryPrice=item.planned_entry??item.current_price; if(entryPrice!==null&&entryPrice!==undefined)params.set('entry_price',String(entryPrice)); if(item.target_price!==null&&item.target_price!==undefined)params.set('take_profit',String(item.target_price)); if(item.stop_loss!==null&&item.stop_loss!==undefined)params.set('stop_loss',String(item.stop_loss))
  const sourceText=[WATCH_SOURCE_LABELS[item.source_type],item.source_name].filter(Boolean).join(' - ')
  const entryReason=[sourceText?`Sumber watchlist: ${sourceText}`:'',item.thesis?`Thesis: ${item.thesis}`:'',item.risk_notes?`Risk: ${item.risk_notes}`:''].filter(Boolean).join('\n')
  if(entryReason)params.set('entry_reason',entryReason.slice(0,1000)); if(item.id)params.set('watchlist_id',item.id); return `/trades/new?${params.toString()}`
}
function statusClass(status:WatchStatus) { return {watching:'bg-blue-500/10 text-blue-400 border-blue-500/30',planned:'bg-amber-500/10 text-amber-400 border-amber-500/30',entered:'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',skipped:'bg-gray-500/10 text-gray-400 border-gray-500/30',archived:'bg-slate-500/10 text-slate-400 border-slate-500/30'}[status] }
function priorityClass(priority:WatchPriority) { return {high:'bg-red-500/10 text-red-400 border-red-500/30',medium:'bg-amber-500/10 text-amber-400 border-amber-500/30',low:'bg-gray-500/10 text-gray-400 border-gray-500/30'}[priority] }
function sourceClass(source:WatchSourceType) { return {telegram:'bg-sky-500/10 text-sky-400 border-sky-500/30',whatsapp:'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',twitter:'bg-blue-500/10 text-blue-400 border-blue-500/30',youtube:'bg-red-500/10 text-red-400 border-red-500/30',news:'bg-amber-500/10 text-amber-400 border-amber-500/30',manual:'bg-violet-500/10 text-violet-400 border-violet-500/30',other:'bg-gray-500/10 text-gray-400 border-gray-500/30'}[source] }
function StatCard({label,value,sub}:{label:string;value:string|number;sub?:string}) { return <div className="rounded-xl border border-[#2a2a3a] bg-[#14141e] p-4"><p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{label}</p><p className="text-xl font-bold text-white font-mono">{value}</p>{sub&&<p className="text-xs text-gray-500 mt-1">{sub}</p>}</div> }

export default function CoinWatchlistPage() {
  const supabase=useMemo(()=>createClient(),[])
  const [items,setItems]=useState<CoinWatchlistItem[]>([])
  const [userId,setUserId]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [schemaMissing,setSchemaMissing]=useState(false)
  const [loadError,setLoadError]=useState<string|null>(null)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [form,setForm]=useState<WatchForm>(EMPTY_FORM)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState<WatchStatus|'all'>('all')
  const [sourceFilter,setSourceFilter]=useState<WatchSourceType|'all'>('all')
  const [itemToDelete,setItemToDelete]=useState<CoinWatchlistItem|null>(null)
  const [deletingId,setDeletingId]=useState<string|null>(null)

  const loadItems=useCallback(async()=>{
    setLoading(true)
    const {data:{user},error:userError}=await supabase.auth.getUser()
    if(userError||!user){setLoading(false);if(userError)toast.error('Gagal membaca user aktif');return}
    setUserId(user.id)
    const {data,error}=await supabase.from('coin_watchlist').select('*').eq('user_id',user.id).order('added_at',{ascending:false})
    if(error){const missing=isMissingTableError(error);setItems([]);setSchemaMissing(missing);setLoadError(error.message);setLoading(false);toast.error(missing?'Tabel watchlist belum aktif':'Gagal memuat watchlist');return}
    setItems((data??[]) as CoinWatchlistItem[]);setSchemaMissing(false);setLoadError(null);setLoading(false)
  },[supabase])
  useEffect(()=>{loadItems()},[loadItems])

  const stats=useMemo(()=>({active:items.filter(i=>i.watch_status==='watching'||i.watch_status==='planned').length,high:items.filter(i=>i.priority==='high').length,social:items.filter(i=>['telegram','whatsapp','twitter'].includes(i.source_type)).length,entered:items.filter(i=>i.watch_status==='entered').length}),[items])
  const filteredItems=useMemo(()=>{const query=search.trim().toLowerCase();return items.filter(i=>statusFilter==='all'||i.watch_status===statusFilter).filter(i=>sourceFilter==='all'||i.source_type===sourceFilter).filter(i=>!query||[i.symbol,i.source_name,i.thesis,i.risk_notes,...(i.tags??[])].filter(Boolean).some(v=>String(v).toLowerCase().includes(query))).sort((a,b)=>{const w:Record<WatchPriority,number>={high:3,medium:2,low:1};return w[b.priority]!==w[a.priority]?w[b.priority]-w[a.priority]:b.conviction_score!==a.conviction_score?b.conviction_score-a.conviction_score:new Date(b.added_at).getTime()-new Date(a.added_at).getTime()})},[items,search,sourceFilter,statusFilter])

  function resetForm(){setEditingId(null);setForm(EMPTY_FORM)}
  function startEdit(item:CoinWatchlistItem){setEditingId(item.id);setForm({symbol:item.symbol,market_type:item.market_type,source_type:item.source_type,source_name:item.source_name??'',source_url:item.source_url??'',watch_status:item.watch_status,priority:item.priority,conviction_score:String(item.conviction_score??5),current_price:item.current_price==null?'':String(item.current_price),planned_entry:item.planned_entry==null?'':String(item.planned_entry),target_price:item.target_price==null?'':String(item.target_price),stop_loss:item.stop_loss==null?'':String(item.stop_loss),thesis:item.thesis??'',risk_notes:item.risk_notes??'',tags:(item.tags??[]).join(', ')});window.scrollTo({top:0,behavior:'smooth'})}

  async function handleSubmit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!userId)return
    const symbol=form.symbol.trim().toUpperCase().replace(/\s+/g,'');if(!symbol){toast.error('Symbol coin wajib diisi');return}
    const now=new Date().toISOString(),payload={user_id:userId,symbol,market_type:form.market_type,source_type:form.source_type,source_name:form.source_name.trim()||null,source_url:normalizeUrl(form.source_url),watch_status:form.watch_status,priority:form.priority,conviction_score:Math.max(1,Math.min(10,Number(form.conviction_score)||5)),current_price:numberOrNull(form.current_price),planned_entry:numberOrNull(form.planned_entry),target_price:numberOrNull(form.target_price),stop_loss:numberOrNull(form.stop_loss),thesis:form.thesis.trim()||null,risk_notes:form.risk_notes.trim()||null,tags:parseTags(form.tags),updated_at:now}
    setSaving(true)
    try{if(editingId){const {data,error}=await supabase.from('coin_watchlist').update(payload).eq('id',editingId).eq('user_id',userId).select().single();if(error)throw error;setItems(current=>current.map(item=>item.id===editingId?data as CoinWatchlistItem:item));toast.success('Watchlist diperbarui')}else{const {data,error}=await supabase.from('coin_watchlist').insert({...payload,added_at:now}).select().single();if(error)throw error;setItems(current=>[data as CoinWatchlistItem,...current]);toast.success('Coin masuk watchlist')}resetForm()}catch(error){toast.error(error instanceof Error?error.message:'Gagal menyimpan watchlist')}finally{setSaving(false)}
  }

  async function updateStatus(item:CoinWatchlistItem,status:WatchStatus){if(!userId)return;const now=new Date().toISOString();const {data,error}=await supabase.from('coin_watchlist').update({watch_status:status,last_reviewed_at:now,updated_at:now}).eq('id',item.id).eq('user_id',userId).select().single();if(error){toast.error('Gagal mengubah status');return}setItems(current=>current.map(row=>row.id===item.id?data as CoinWatchlistItem:row))}
  async function removeItem(){
    if(!userId||!itemToDelete)return
    setDeletingId(itemToDelete.id)
    const {error}=await supabase.from('coin_watchlist').delete().eq('id',itemToDelete.id).eq('user_id',userId)
    if(error){toast.error('Gagal menghapus watchlist');setDeletingId(null);return}
    setItems(current=>current.filter(row=>row.id!==itemToDelete.id));toast.success('Coin dihapus dari watchlist');setDeletingId(null);setItemToDelete(null)
  }

  const inputClass='w-full rounded-lg border border-[#2a2a3a] bg-[#0f0f19] px-3 py-2 text-sm text-white outline-none focus:border-blue-500'
  return <div className="p-6 space-y-5">
    <ConfirmDialog open={Boolean(itemToDelete)} onOpenChange={open=>{if(!open)setItemToDelete(null)}} onConfirm={removeItem} loading={deletingId===itemToDelete?.id} title="Hapus dari watchlist?" description={<>Coin <strong className="text-gray-200">{itemToDelete?.symbol}</strong> akan dihapus dari daftar pantau dan tidak dapat dikembalikan.</>} confirmLabel="Hapus Coin" />
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-white font-bold text-lg">Coin Watchlist</h1><p className="text-gray-400 text-xs mt-0.5">Pantau ide coin dari Telegram, WhatsApp, Twitter/X, news, dan catatan manual.</p></div><button type="button" onClick={loadItems} className="inline-flex items-center gap-2 rounded-lg border border-[#2a2a3a] bg-[#14141e] px-3 py-2 text-xs font-bold text-gray-200 hover:bg-[#1a1a2a]"><RefreshCw className="w-4 h-4"/> Refresh</button></div>
    {schemaMissing&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Tabel `coin_watchlist` belum aktif di database production. Jalankan `supabase/migrations/20260610_add_coin_watchlist.sql` di Supabase SQL Editor, lalu refresh halaman ini.</div>}
    {loadError&&!schemaMissing&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{loadError}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><StatCard label="Active Ideas" value={stats.active} sub="Watching + planned"/><StatCard label="High Priority" value={stats.high} sub="Butuh review cepat"/><StatCard label="Social Sources" value={stats.social} sub="Telegram, WA, Twitter/X"/><StatCard label="Entered" value={stats.entered} sub="Sudah masuk trade"/></div>
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 items-start">
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#2a2a3a] bg-[#14141e] p-4 space-y-4">
        <div className="flex items-center justify-between gap-2"><h2 className="text-gray-200 text-sm font-semibold">{editingId?'Edit Watchlist':'Tambah Coin Pantauan'}</h2>{editingId&&<button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"><XCircle className="w-3.5 h-3.5"/> Batal</button>}</div>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-xs text-gray-400">Symbol</span><input value={form.symbol} onChange={e=>setForm({...form,symbol:e.target.value})} placeholder="BTCUSDT" className={inputClass}/></label><label className="space-y-1.5"><span className="text-xs text-gray-400">Market</span><select value={form.market_type} onChange={e=>setForm({...form,market_type:e.target.value as WatchMarketType})} className={inputClass}>{marketOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="space-y-1.5"><span className="text-xs text-gray-400">Source</span><select value={form.source_type} onChange={e=>setForm({...form,source_type:e.target.value as WatchSourceType})} className={inputClass}>{sourceOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="space-y-1.5"><span className="text-xs text-gray-400">Priority</span><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as WatchPriority})} className={inputClass}>{priorityOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
        <label className="space-y-1.5 block"><span className="text-xs text-gray-400">Nama channel / group</span><input value={form.source_name} onChange={e=>setForm({...form,source_name:e.target.value})} placeholder="Contoh: Alpha Group, akun X, channel news" className={inputClass}/></label>
        <label className="space-y-1.5 block"><span className="text-xs text-gray-400">Link sumber</span><input value={form.source_url} onChange={e=>setForm({...form,source_url:e.target.value})} placeholder="https://..." className={inputClass}/></label>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-xs text-gray-400">Status</span><select value={form.watch_status} onChange={e=>setForm({...form,watch_status:e.target.value as WatchStatus})} className={inputClass}>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="space-y-1.5"><span className="text-xs text-gray-400">Conviction {form.conviction_score}/10</span><input type="range" min="1" max="10" value={form.conviction_score} onChange={e=>setForm({...form,conviction_score:e.target.value})} className="w-full accent-blue-500"/></label></div>
        <div className="grid grid-cols-2 gap-3">{([['current_price','Current'],['planned_entry','Entry Plan'],['target_price','Target'],['stop_loss','Stop Loss']] as const).map(([key,label])=><label key={key} className="space-y-1.5"><span className="text-xs text-gray-400">{label}</span><input inputMode="decimal" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder="0.00" className={inputClass}/></label>)}</div>
        <label className="space-y-1.5 block"><span className="text-xs text-gray-400">Alasan pantau</span><textarea value={form.thesis} onChange={e=>setForm({...form,thesis:e.target.value})} rows={3} placeholder="Catalyst, narasi, setup teknikal, atau alasan sinyal layak dipantau" className={`${inputClass} resize-none`}/></label>
        <label className="space-y-1.5 block"><span className="text-xs text-gray-400">Risiko / invalidasi</span><textarea value={form.risk_notes} onChange={e=>setForm({...form,risk_notes:e.target.value})} rows={2} placeholder="Hal yang membuat ide ini batal atau harus dihindari" className={`${inputClass} resize-none`}/></label>
        <label className="space-y-1.5 block"><span className="text-xs text-gray-400">Tags</span><input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="ai, meme, layer2" className={inputClass}/></label>
        <button type="submit" disabled={saving||!userId||schemaMissing} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><PlusCircle className="w-4 h-4"/> {saving?'Menyimpan...':editingId?'Update Watchlist':'Tambah Watchlist'}</button>
      </form>
      <div className="space-y-4 min-w-0">
        <div className="rounded-xl border border-[#2a2a3a] bg-[#14141e] p-3 flex flex-col lg:flex-row gap-3"><div className="relative flex-1 min-w-[220px]"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari symbol, sumber, tag, atau thesis" className={`${inputClass} pl-9`}/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as WatchStatus|'all')} className={inputClass}><option value="all">All Status</option>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value as WatchSourceType|'all')} className={inputClass}><option value="all">All Sources</option>{sourceOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        <div className="rounded-xl border border-[#2a2a3a] bg-[#14141e] overflow-hidden"><div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between gap-3"><h2 className="text-gray-200 text-sm font-semibold">Daftar Pantau</h2><span className="text-gray-500 text-xs">{filteredItems.length} dari {items.length} coin</span></div>
          {loading?<div className="p-8 text-center text-gray-400 text-sm animate-pulse">Memuat watchlist...</div>:filteredItems.length===0?<div className="p-8 text-center"><p className="text-gray-300 text-sm font-semibold">Belum ada coin sesuai filter</p><p className="text-gray-500 text-xs mt-1">Tambah coin dari sinyal group, chat, Twitter/X, news, atau catatan pribadi.</p></div>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[#2a2a3a]">{['Coin','Source','Plan','Thesis','Status','Review','Actions'].map(h=><th key={h} className="text-left text-gray-400 text-xs font-medium uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#1e1e2e]">{filteredItems.map(item=>{const upside=priceUpside(item),sourceUrl=normalizeUrl(item.source_url??'');return <tr key={item.id} className="hover:bg-[#1a1a2a] transition-colors align-top">
            <td className="px-4 py-4 min-w-[160px]"><div className="flex items-center gap-2"><span className="text-gray-100 font-bold">{item.symbol}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityClass(item.priority)}`}>{WATCH_PRIORITY_LABELS[item.priority]}</span></div><p className="text-gray-500 text-xs mt-1 capitalize">{item.market_type} - conviction {item.conviction_score}/10</p>{(item.tags??[]).length>0&&<div className="flex flex-wrap gap-1 mt-2">{(item.tags??[]).slice(0,3).map(tag=><span key={tag} className="rounded bg-[#0f0f19] px-2 py-0.5 text-[10px] text-gray-400">#{tag}</span>)}</div>}</td>
            <td className="px-4 py-4 min-w-[170px]"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${sourceClass(item.source_type)}`}>{WATCH_SOURCE_LABELS[item.source_type]}</span>{item.source_name&&<p className="text-gray-300 text-xs mt-2 max-w-[180px] truncate">{item.source_name}</p>}{sourceUrl&&<a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs mt-1">Source <ExternalLink className="w-3 h-3"/></a>}</td>
            <td className="px-4 py-4 min-w-[190px] font-mono text-xs text-gray-300"><div className="grid grid-cols-2 gap-x-3 gap-y-1"><span className="text-gray-500">Now</span><span>{formatPrice(item.current_price)}</span><span className="text-gray-500">Entry</span><span>{formatPrice(item.planned_entry)}</span><span className="text-gray-500">Target</span><span>{formatPrice(item.target_price)}</span><span className="text-gray-500">Stop</span><span>{formatPrice(item.stop_loss)}</span></div>{upside!==null&&<p className={`mt-2 font-bold ${upside>=0?'text-emerald-400':'text-red-400'}`}>{upside>=0?'+':''}{upside.toFixed(2)}% to target</p>}</td>
            <td className="px-4 py-4 min-w-[260px] max-w-[360px]"><p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{item.thesis??'-'}</p>{item.risk_notes&&<p className="text-red-300/80 text-xs leading-relaxed mt-2 line-clamp-2">Risk: {item.risk_notes}</p>}</td>
            <td className="px-4 py-4 min-w-[150px]"><select value={item.watch_status} onChange={e=>updateStatus(item,e.target.value as WatchStatus)} className={`rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${statusClass(item.watch_status)} bg-[#0f0f19]`}>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
            <td className="px-4 py-4 min-w-[110px] text-xs text-gray-500"><p>Added {formatDate(item.added_at)}</p><p className="mt-1">Reviewed {formatDate(item.last_reviewed_at)}</p></td>
            <td className="px-4 py-4 min-w-[230px]"><div className="flex flex-wrap gap-2"><Link href={buildTradeHref(item)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/15 px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-600/25"><CheckCircle2 className="w-3.5 h-3.5"/> Trade</Link><button type="button" onClick={()=>startEdit(item)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600/15 px-2.5 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-600/25"><Pencil className="w-3.5 h-3.5"/> Edit</button><button type="button" onClick={()=>updateStatus(item,'archived')} className="inline-flex items-center gap-1 rounded-lg bg-gray-600/15 px-2.5 py-1.5 text-xs font-bold text-gray-400 hover:bg-gray-600/25"><Archive className="w-3.5 h-3.5"/> Archive</button><button type="button" onClick={()=>setItemToDelete(item)} disabled={deletingId===item.id} className="inline-flex items-center gap-1 rounded-lg bg-red-600/15 px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-600/25 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5"/> Delete</button></div></td>
          </tr>})}</tbody></table></div>}
        </div>
      </div>
    </div>
  </div>
}
