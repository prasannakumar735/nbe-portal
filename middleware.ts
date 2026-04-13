import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware'

/**
 * Staff portal paths that require a Supabase session (not client-role).
 * Public routes (`/login`, `/report/view/*`, `/client/*` marketing pages) stay out of this list.
 * The `(portal)` route group still enforces auth in `app/(portal)/layout.tsx`; this matcher
 * refreshes the session cookie on navigation for these prefixes.
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/timecard',
  '/timecard-enhanced',
  '/calendar',
  '/maintenance',
  '/reimbursement',
  '/pvc-calculator',
  '/qr-codes',
  '/qr',
  '/manager',
  '/admin/inventory',
  '/admin/contacts',
  '/admin/orders',
  '/reports',
  '/knowledge',
  '/job-card',
] as const

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.auth.signOut()
    const login = new URL('/login', request.url)
    login.searchParams.set('error', 'no_profile')
    return NextResponse.redirect(login)
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut()
    const login = new URL('/login', request.url)
    login.searchParams.set('inactive', '1')
    return NextResponse.redirect(login)
  }

  if (profile.role === 'client') {
    return NextResponse.redirect(new URL('/client', request.url))
  }

  if (pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/people')) {
    const role = profile.role
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (pathname === '/dashboard/timecards') {
    const tab = request.nextUrl.searchParams.get('tab')
    if (tab === 'team') {
      const role = profile.role
      if (role !== 'admin' && role !== 'manager') {
        const url = request.nextUrl.clone()
        url.searchParams.set('tab', 'my')
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

/** Static matchers only — Next.js cannot parse computed `matcher` (see route segment config). */
export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/timecard',
    '/timecard/:path*',
    '/timecard-enhanced',
    '/timecard-enhanced/:path*',
    '/calendar',
    '/calendar/:path*',
    '/maintenance',
    '/maintenance/:path*',
    '/reimbursement',
    '/reimbursement/:path*',
    '/pvc-calculator',
    '/pvc-calculator/:path*',
    '/qr-codes',
    '/qr-codes/:path*',
    '/qr',
    '/qr/:path*',
    '/manager',
    '/manager/:path*',
    '/admin/inventory',
    '/admin/inventory/:path*',
    '/admin/contacts',
    '/admin/contacts/:path*',
    '/admin/orders',
    '/admin/orders/:path*',
    '/reports',
    '/reports/:path*',
    '/knowledge',
    '/knowledge/:path*',
    '/job-card',
    '/job-card/:path*',
  ],
}
