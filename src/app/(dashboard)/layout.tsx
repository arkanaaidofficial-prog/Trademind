'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const NAV = [
  { href: '/dashboard', icon: '⬛', label: 'Dashboard' },
  { href: '/trades', icon: '📋', label: 'Trades' },
  { href: '/analytics', icon: '📊', label: 'Analytics' },
  { href: '/bot', icon: '🤖', label: 'Bot Journal' },
  { href: '/reviews', icon: '📝', label: 'Reviews' },
  { href: '/rules', icon: '📏', label: 'Rules' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name,
        })
      }
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Logout berhasil')
    router.push('/login')
  }

  const initials = user?.full_name?.charAt(0)?.toUpperCase() ?? 'T'

  return (
    <div className="flex h-screen bg-[#0a0a14] overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-56 flex-shrink-0
        bg-[#0e0e18] border-r border-[#1e1e2e] flex flex-col
        transform transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="p-5 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-black">T</div>
            <span className="text-white font-bold text-sm tracking-tight">TradeMind</span>
          </div>
          <p className="text-gray-500 text-[10px] mt-0.5 ml-9">Journal & Analytics</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30 font-medium'
                    : 'text-gray-400 hover:bg-[#1a1a2a] hover:text-gray-200'
                }`}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[#1e1e2e] space-y-1">
          <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-[#1a1a2a] hover:text-gray-200 text-sm transition-all">
            <span>⚙️</span> Settings
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition-all">
            <span>🚪</span> Logout
          </button>
          <div className="flex items-center gap-2 px-2 py-2 mt-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-gray-200 text-xs font-medium truncate">{user?.full_name ?? 'Trader'}</p>
              <p className="text-gray-500 text-[10px] truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden h-12 border-b border-[#1e1e2e] bg-[#0e0e18] flex items-center justify-between px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white text-xl">☰</button>
          <span className="text-white font-bold text-sm">TradeMind</span>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
        </div>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
