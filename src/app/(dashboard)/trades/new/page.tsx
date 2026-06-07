'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TradeForm from '@/components/trades/TradeForm'

export default function NewTradePage() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  if (!userId) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm animate-pulse">Memuat...</p></div>

  return (
    <div>
      <div className="px-6 py-4 border-b border-[#1e1e2e] bg-[#0e0e18] flex items-center gap-3">
        <h1 className="text-white font-bold">Tambah Trade Baru</h1>
      </div>
      <TradeForm userId={userId} mode="add" />
    </div>
  )
}
