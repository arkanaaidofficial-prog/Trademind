'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Akun berhasil dibuat! Cek email untuk verifikasi.')
    router.push('/login')
  }

  const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors'

  return (
    <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xl font-black mx-auto mb-4">T</div>
          <h1 className="text-white text-2xl font-bold">Buat Akun</h1>
          <p className="text-gray-400 text-sm mt-1">Mulai jurnal trading kamu hari ini</p>
        </div>
        <form onSubmit={handleRegister} className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Nama Lengkap</label>
            <input type="text" required className={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ahmad Trader" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Email</label>
            <input type="email" required className={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="trader@email.com" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">Password</label>
            <input type="password" required minLength={6} className={inp} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 karakter" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors mt-2">
            {loading ? 'Membuat akun...' : 'Daftar Sekarang'}
          </button>
        </form>
        <p className="text-gray-500 text-sm text-center mt-4">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
