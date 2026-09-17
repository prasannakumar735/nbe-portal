import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { assertJsonContentLength, PayloadTooLargeError } from '@/lib/security/httpRequestLimits'
import { recordFailure, resetFailures } from '@/lib/security/ipBlocker'
import { getClientIp } from '@/lib/security/rateLimitEdge'
import { loginBodySchema } from '@/lib/security/schemas/authSchemas'
import { isTurnstileEnforced } from '@/lib/security/turnstileConfig'
import { verifyTurnstileToken } from '@/lib/security/verifyTurnstile'
import { sanitizePlainText } from '@/lib/validation/safeText'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    assertJsonContentLength(request, 32_768)
    const raw = await request.json().catch(() => null)
    const parsed = loginBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const email = sanitizePlainText(parsed.data.email, 320).trim().toLowerCase()
    const password = parsed.data.password
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
    }

    if (isTurnstileEnforced()) {
      const ip = getClientIp(request)
      const captcha = await verifyTurnstileToken(parsed.data.turnstileToken, ip)
      if (!captcha.ok) {
        const msg =
          captcha.reason === 'captcha_required'
            ? 'Please complete the CAPTCHA.'
            : captcha.reason === 'captcha_unavailable'
              ? 'CAPTCHA verification is temporarily unavailable. Try again.'
              : 'CAPTCHA verification failed. Try again.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    // Collect cookies set by Supabase during sign-in, apply them to the final response.
    // The role/isActive are fetched before building the response so a single
    // NextResponse.json carries the body and all Set-Cookie headers together.
    type CookieEntry = { name: string; value: string; options: Record<string, unknown> }
    const pendingCookies: CookieEntry[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Collect for later — response doesn't exist yet
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options: options as Record<string, unknown> })
            })
          },
        },
      },
    )

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      const ip = getClientIp(request)
      void recordFailure(ip).catch(() => {})
      return NextResponse.json(
        {
          error:
            signInError.message.includes('Invalid login credentials') || signInError.status === 400
              ? 'Invalid email or password.'
              : signInError.message.includes('Email not confirmed')
                ? 'Please confirm your email address before logging in.'
                : signInError.message,
        },
        { status: 401 },
      )
    }

    void resetFailures(getClientIp(request)).catch(() => {})

    // Fetch role/isActive so the client can redirect without a browser Supabase client
    let role: string | null = null
    let isActive = true
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle()
      role = profile?.role ?? null
      isActive = profile?.is_active !== false
    }

    // Build the final response with correct body, then apply all collected cookies
    const response = NextResponse.json({ ok: true, role, isActive })
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    return response
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }
    return jsonError500(e, 'auth-login')
  }
}
