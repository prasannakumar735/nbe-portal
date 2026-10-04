import { NextResponse, type NextRequest } from 'next/server'
import { requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { generateSsoCode, hashSsoCode, SSO_CODE_TTL_SECONDS } from '@/lib/sso/intelligence'



/**
 * SSO handoff to NBE Intelligence. Only admin/manager may use this (same
 * gate `requireManagerOrAdminApi` already enforces on every other admin
 * route). Issues a short-lived, single-use opaque code — never a Supabase
 * JWT/access/refresh token — and redirects to Intelligence's exchange
 * endpoint, which validates and consumes it server-side.
 */
export async function GET(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const intelligenceUrl = (process.env.INTELLIGENCE_APP_URL ?? '').trim()
  if (!intelligenceUrl) {
    console.error('[sso] INTELLIGENCE_APP_URL is not configured')
    return NextResponse.json({ ok: false, error: 'Market Intelligence is not configured.' }, { status: 500 })
  }

  const rawCode = generateSsoCode()
  const expiresAt = new Date(Date.now() + SSO_CODE_TTL_SECONDS * 1000).toISOString()

  const { error } = await auth.supabase.from('sso_handoff_codes').insert({
    code_hash: hashSsoCode(rawCode),
    user_id: auth.userId,
    target_app: 'nbe_intelligence',
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[sso] could not create handoff code:', error.message)
    return NextResponse.json({ ok: false, error: 'Could not start Market Intelligence sign-in.' }, { status: 500 })
  }

  const redirectUrl = new URL('/auth/sso', intelligenceUrl)
  redirectUrl.searchParams.set('code', rawCode)

  return NextResponse.redirect(redirectUrl)
}
