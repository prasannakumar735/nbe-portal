import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendPasswordResetSuccessEmail } from '@/lib/auth/sendPasswordResetSuccessEmail'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import {
  withSecurityLogging,
  type ApiSecurityBinding,
  type SecurityRequest,
} from '@/lib/security/withSecurityLogging'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

/**
 * POST — send “password reset successful” email to the signed-in user.
 * Used after client-side `auth.updateUser({ password })` (Supabase recovery session).
 */
async function postPasswordResetSuccessEmail(request: SecurityRequest, sec: ApiSecurityBinding) {
  try {
    assertJsonContentLength(request, 4096)
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user?.email) {
      sec.logUnauthorized('no_session')
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    try {
      await sendPasswordResetSuccessEmail(user.email)
    } catch (e) {
      console.error('[password-reset-success-email] Graph send failed', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError500(e, 'password-reset-success-email')
  }
}

export const POST = withSecurityLogging(
  'POST /api/auth/password-reset-success-email',
  postPasswordResetSuccessEmail,
)
