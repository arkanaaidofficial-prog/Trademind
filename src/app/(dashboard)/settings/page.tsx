'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AVATARS_BUCKET } from '@/lib/supabase/storage'
import { toast } from 'sonner'

const inp = 'w-full bg-[#1a1a2a] border border-[#2a2a3a] text-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600'
const lbl = 'block text-gray-400 text-xs font-medium mb-1.5'

type Profile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  trading_style: string | null
  preferred_market: string | null
  timezone: string | null
  account_balance: number | null
  risk_per_trade: number | null
}

const TRADING_STYLES = ['day_trading', 'swing_trading', 'scalping', 'position_trading', 'algo_trading']
const MARKETS = ['crypto', 'forex', 'saham', 'futures', 'multi']
const TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Tokyo',
  'America/New_York',
  'Europe/London',
  'UTC',
]

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'trading' | 'account' | 'security'>('profile')
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser({ id: data.user.id, email: data.user.email })

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (prof) {
        setProfile(prof)
      } else {
        setProfile({
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name ?? '',
        })
      }
      setLoading(false)
    })
  }, [])

  function set(key: string, value: unknown) {
    setProfile(p => ({ ...p, [key]: value }))
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran avatar max 2MB'); return }

    setUploadingAvatar(true)
    const supabase = createClient()
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      toast.error('Gagal upload avatar: ' + uploadErr.message)
      setUploadingAvatar(false)
      return
    }

    const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
    set('avatar_url', urlData.publicUrl)
    setUploadingAvatar(false)
    toast.success('Avatar berhasil diupload!')
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      id: user.id,
      full_name: profile.full_name ?? null,
      username: profile.username ?? null,
      avatar_url: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
      trading_style: profile.trading_style ?? null,
      preferred_market: profile.preferred_market ?? null,
      timezone: profile.timezone ?? null,
      account_balance: profile.account_balance ? Number(profile.account_balance) : null,
      risk_per_trade: profile.risk_per_trade ? Number(profile.risk_per_trade) : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(payload)
    if (error) {
      toast.error('Gagal menyimpan: ' + error.message)
    } else {
      await supabase.auth.updateUser({ data: { full_name: profile.full_name } })
      toast.success('Profil berhasil disimpan!')
    }
    setSaving(false)
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const newPass = fd.get('new_password') as string
    const confirm = fd.get('confirm_password') as string
    if (newPass !== confirm) { toast.error('Password tidak cocok'); return }
    if (newPass.length < 6) { toast.error('Password min 6 karakter'); return }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) toast.error('Gagal ganti password: ' + error.message)
    else { toast.success('Password berhasil diubah!'); (e.target as HTMLFormElement).reset() }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="text-gray-500 text-sm">Memuat profil...</div>
    </div>
  )

  const tabs = [
    { key: 'profile', label: 'Profil' },
    { key: 'trading', label: 'Trading' },
    { key: 'account', label: 'Akun' },
    { key: 'security', label: 'Keamanan' },
  ] as const

  const initials = profile.full_name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? 'T'

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-white font-bold text-xl">Settings</h1>
        <p className="text-gray-500 text-xs mt-1">Kelola profil dan preferensi trading kamu</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0e0e18] border border-[#1e1e2e] rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === t.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          {/* Avatar */}
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5">
            <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3 mb-4">Foto Profil</h2>
            <div className="flex items-center gap-5">
              <div className="relative">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-[#2a2a3a]" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {initials}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <button onClick={() => avatarRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="bg-[#1e1e2e] hover:bg-[#2a2a3a] text-gray-200 px-4 py-2 rounded-xl text-xs font-medium border border-[#2a2a3a] transition-colors disabled:opacity-50">
                  {uploadingAvatar ? 'Mengupload...' : 'Ganti Foto'}
                </button>
                <p className="text-gray-500 text-[10px]">JPG, PNG max 2MB</p>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          {/* Info */}
          <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
            <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Informasi Pribadi</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Nama Lengkap</label>
                <input className={inp} value={profile.full_name ?? ''} onChange={e => set('full_name', e.target.value)} placeholder="Nama kamu" />
              </div>
              <div>
                <label className={lbl}>Username</label>
                <input className={inp} value={profile.username ?? ''} onChange={e => set('username', e.target.value)} placeholder="@username" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Email</label>
                <input className={inp + ' opacity-50 cursor-not-allowed'} value={user?.email ?? ''} disabled />
                <p className="text-gray-600 text-[10px] mt-1">Email tidak bisa diubah dari sini</p>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Bio Singkat</label>
                <textarea className={inp + ' resize-none'} rows={3}
                  value={profile.bio ?? ''} onChange={e => set('bio', e.target.value)}
                  placeholder="Cerita singkat tentang kamu sebagai trader..." />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trading Tab */}
      {activeTab === 'trading' && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
          <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Preferensi Trading</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Gaya Trading</label>
              <select className={inp + ' cursor-pointer'} value={profile.trading_style ?? ''} onChange={e => set('trading_style', e.target.value)}>
                <option value="">— Pilih —</option>
                {TRADING_STYLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Pasar Utama</label>
              <select className={inp + ' cursor-pointer'} value={profile.preferred_market ?? ''} onChange={e => set('preferred_market', e.target.value)}>
                <option value="">— Pilih —</option>
                {MARKETS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Timezone</label>
              <select className={inp + ' cursor-pointer'} value={profile.timezone ?? ''} onChange={e => set('timezone', e.target.value)}>
                <option value="">— Pilih —</option>
                {TIMEZONES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
          <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Informasi Akun Trading</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Modal Awal / Balance ($)</label>
              <input type="number" step="any" className={inp}
                value={profile.account_balance ?? ''} onChange={e => set('account_balance', e.target.value)}
                placeholder="1000" />
            </div>
            <div>
              <label className={lbl}>Risk per Trade (%)</label>
              <input type="number" step="0.1" min="0" max="100" className={inp}
                value={profile.risk_per_trade ?? ''} onChange={e => set('risk_per_trade', e.target.value)}
                placeholder="2" />
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-xs font-medium">Tips Manajemen Risiko</p>
            <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">
              Trader profesional umumnya risk 1–2% per trade. Dengan balance ${profile.account_balance ?? 1000},
              risk {profile.risk_per_trade ?? 2}% per trade = <strong className="text-gray-200">
                ${(((Number(profile.account_balance) || 1000) * (Number(profile.risk_per_trade) || 2)) / 100).toFixed(2)}
              </strong> per posisi.
            </p>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="bg-[#14141e] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
          <h2 className="text-gray-200 font-semibold text-sm border-b border-[#2a2a3a] pb-3">Ganti Password</h2>
          <div>
            <label className={lbl}>Password Baru</label>
            <input name="new_password" type="password" className={inp} placeholder="Min 6 karakter" required minLength={6} />
          </div>
          <div>
            <label className={lbl}>Konfirmasi Password</label>
            <input name="confirm_password" type="password" className={inp} placeholder="Ulangi password baru" required minLength={6} />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            Ganti Password
          </button>
        </form>
      )}

      {/* Save button (hide on security tab) */}
      {activeTab !== 'security' && (
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-colors">
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      )}
    </div>
  )
}
