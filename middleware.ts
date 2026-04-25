import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware'
import { buildContentSecurityPolicy, generateCspNonce } from '@/lib/security/csp'
import { getApiRateLimitTier } from '@/lib/security/apiPathTiers'
import { enforceDistributedRateLimit } from '@/lib/security/rateLimitDistributed'
import { IP_BAN_RETRY_AFTER_SEC, isBlocked, recordFailure } from '@/lib/security/ipBlocker'
import { getClientIp } from '@/lib/security/rateLimitEdge'
import { isSuspiciousApiRequest } from '@/lib/security/botDefense'
import { NBE_REQUEST_ID_HEADER, truncateUserAgent } from '@/lib/security/requestIdentity'
import { logSecurityEvent, securityLog, securityLogIpBlocked } from '@/lib/security/securityLogger'

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

function isReportPdfApiPath(pathname: string): boolean {
  return (
    (pathname.startsWith('/api/client/merged-report/') && pathname.endsWith('/file')) ||
    (pathname.startsWith('/api/client/maintenance-report/') && pathname.endsWith('/file'))
  )
}

function setCsp(response: NextResponse, csp: string) {
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export async function middleware(request: NextRequest) {
  // Fresh nonce + CSP per request — must match `headers().get('x-nonce')` in RSC and Turnstile `<Script nonce>`.
  const nonce = generateCspNonce()
  // Default is clickjacking-safe (`frame-ancestors 'none'`), but embedded PDF viewer needs
  // the PDF response to allow same-origin framing.
  const csp = buildContentSecurityPolicy(nonce, {
    frameAncestors: isReportPdfApiPath(request.nextUrl.pathname) ? "'self'" : "'none'",
  })
  const requestHeaders = new Headers(request.headers)
  const incomingRequestId = request.headers.get(NBE_REQUEST_ID_HEADER)?.trim()
  const requestId = incomingRequestId || crypto.randomUUID()
  requestHeaders.set(NBE_REQUEST_ID_HEADER, requestId)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const { pathname } = request.nextUrl
  const clientIp = getClientIp(request)
  const ua = truncateUserAgent(request.headers.get('user-agent'))

  if (pathname.startsWith('/api')) {
    if (await isBlocked(clientIp)) {
      securityLogIpBlocked(
        {
          path: pathname,
          method: request.method,
          ip: clientIp,
          user_agent: ua,
          route_name: pathname,
          correlation_id: requestId,
        },
        request,
      )
      return setCsp(
        NextResponse.json(
          { error: 'Too many attempts. Try later.' },
          {
            status: 429,
            headers: { 'Retry-After': String(IP_BAN_RETRY_AFTER_SEC) },
          },
        ),
        csp,
      )
    }

    if (isSuspiciousApiRequest(request, pathname)) {
      logSecurityEvent(
        'bot_blocked',
        {
          monitoring: { signal: 'bot_block' },
          path: pathname,
          method: request.method,
          ip: clientIp,
          user_agent: ua,
          route_name: pathname,
          correlation_id: requestId,
          http_status_code: 400,
          detail: 'missing_user_agent',
        },
        request,
      )
      return setCsp(NextResponse.json({ error: 'Bad request.' }, { status: 400 }), csp)
    }

    const tier = getApiRateLimitTier(pathname)
    const rl = await enforceDistributedRateLimit(clientIp, pathname, tier)
    if (!rl.ok) {
      if (tier === 'auth') {
        await recordFailure(clientIp)
      }
      logSecurityEvent(
        'rate_limit_exceeded',
        {
          monitoring: { signal: 'rate_limit_429' },
          path: pathname,
          method: request.method,
          ip: clientIp,
          user_agent: ua,
          route_name: pathname,
          correlation_id: requestId,
          tier,
          http_status_code: 429,
          detail: `retry_after_s=${rl.retryAfterSec}`,
        },
        request,
      )
      return setCsp(
        NextResponse.json(
          { error: 'Too many requests.' },
          {
            status: 429,
            headers: { 'Retry-After': String(rl.retryAfterSec) },
          },
        ),
        csp,
      )
    }

    return setCsp(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      csp,
    )
  }

  if (!isProtectedPath(pathname)) {
    return setCsp(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      csp,
    )
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request, requestHeaders)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (process.env.SECURITY_LOG_SESSION_REDIRECTS === '1') {
      securityLog(
        {
          event: 'session_required',
          monitoring: { signal: 'session_required_redirect' },
          path: pathname,
          method: request.method,
          ip: clientIp,
          user_agent: ua,
          correlation_id: requestId,
          route_name: pathname,
          http_status_code: 307,
          detail: 'redirect_to_login',
        },
        request,
      )
    }
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname)
    return setCsp(NextResponse.redirect(login), csp)
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
    return setCsp(NextResponse.redirect(login), csp)
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut()
    const login = new URL('/login', request.url)
    login.searchParams.set('inactive', '1')
    return setCsp(NextResponse.redirect(login), csp)
  }

  if (profile.role === 'client') {
    return setCsp(NextResponse.redirect(new URL('/client', request.url)), csp)
  }

  if (pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/people')) {
    const role = profile.role
    if (role !== 'admin' && role !== 'manager') {
      return setCsp(NextResponse.redirect(new URL('/dashboard', request.url)), csp)
    }
  }

  if (pathname === '/dashboard/timecards') {
    const tab = request.nextUrl.searchParams.get('tab')
    if (tab === 'team') {
      const role = profile.role
      if (role !== 'admin' && role !== 'manager') {
        const url = request.nextUrl.clone()
        url.searchParams.set('tab', 'my')
        return setCsp(NextResponse.redirect(url), csp)
      }
    }
  }

  return setCsp(response, csp)
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
