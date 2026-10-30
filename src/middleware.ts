import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type OpsiKuki = Partial<{
  domain: string
  expires: Date
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: boolean | 'lax' | 'strict' | 'none'
  secure: boolean
}>

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  // Parameters<typeof cookies.set>[0] pada fungsi ber-OVERLOAD mengambil
  // overload TERAKHIR, jadi hasilnya `string | RequestCookie` dan
  // pemaksaan tipenya tidak pernah sah. Ditulis ulang tanpa paksaan.
  function tulisKuki(name: string, value: string, options: OpsiKuki) {
    request.cookies.set({ name, value, ...options })
    response = NextResponse.next({ request: { headers: request.headers } })
    response.cookies.set({ name, value, ...options })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: OpsiKuki) {
          tulisKuki(name, value, options)
        },
        remove(name: string, options: OpsiKuki) {
          tulisKuki(name, '', options)
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
