'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TradeForm from '@/components/trades/TradeForm'
import type { Trade } from '@/types/trade'

export default function EditTradePage() {
  const { id } = useParams<{ id: string }>()
  const [trade, setTrade] = useState<Trade | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setLoading(false)
        return
      }

      setUserId(user.id)
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      setTrade(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 animate-pulse text-sm">Memuat...</p></div>
  if (!trade || !userId) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Trade tidak ditemukan</p></div>

  return (
    <div>
      <div className="px-6 py-4 border-b border-[#1e1e2e] bg-[#0e0e18]">
        <h1 className="text-white font-bold">Edit Trade - {trade.symbol}</h1>
      </div>
      <TradeForm trade={trade} userId={userId} mode="edit" />
    </div>
  )
}
