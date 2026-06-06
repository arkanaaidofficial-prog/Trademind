'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Login berhasil!')
    router.push('/dashboard')
    router.refresh()
  }

  const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors'

  return (
    <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xl font-black mx-auto mb-4">T</div>
          <h1 className="text-white text-2xl font-bold">TradeMind Journal</h1>
          <p className="text-gray-400 text-sm mt-1">Masuk ke akun trading kamu</p>
        </div>
        <form onSubmit={handleLogin} className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Email</label>
            <input type="email" required className={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="trader@email.com" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Password</label>
            <input type="password" required className={inp} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors mt-2">
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
        <p className="text-gray-500 text-sm text-center mt-4">
          Belum punya akun?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">Daftar sekarang</Link>
        </p>
      </div>
    </div>
  )
}
