'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const NAV = [
  {
    href: '/dashboard', label: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  },
  {
    href: '/trades', label: 'Trades',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
  },
  {
    href: '/analytics', label: 'Analytics',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  },
  {
    href: '/bot', label: 'Bot Journal',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 15h.01M16 15h.01"/></svg>
  },
  {
    href: '/reviews', label: 'Reviews',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  },
  {
    href: '/rules', label: 'Rules',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
  },
]

const SettingsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
const LogoutIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
const MenuIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>

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
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

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
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[#1e1e2e] space-y-1">
          <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-[#1a1a2a] hover:text-gray-200 text-sm transition-all">
            <SettingsIcon /> Settings
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition-all">
            <LogoutIcon /> Logout
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden h-12 border-b border-[#1e1e2e] bg-[#0e0e18] flex items-center justify-between px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white">
            <MenuIcon />
          </button>
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
