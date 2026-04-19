import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { sendPasswordResetSuccessEmail } from '@/lib/auth/sendPasswordResetSuccessEmail'
import { validatePasswordPolicy } from '@/lib/validation/passwordPolicy'
import { sanitizePlainText } from '@/lib/validation/safeText'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import { withSecurityLogging, type ApiSecurityBinding, type SecurityRequest } from '@/lib/security/withSecurityLogging'
import { resetPasswordConfirmBodySchema } from '@/lib/security/schemas/authSchemas'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

async function postResetPasswordConfirm(request: SecurityRequest, _sec: ApiSecurityBinding) {
  try {
    assertJsonContentLength(request, 65_536)
    const rawBody = await request.json().catch(() => null)
    const parsed = resetPasswordConfirmBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const token = sanitizePlainText(parsed.data.token, 128)
    const password = parsed.data.password

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 })
    }

    const policy = validatePasswordPolicy(password)
    if (!policy.valid) {
      return NextResponse.json({ error: policy.errors.join(' ') }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const tokenHash = hashToken(token)

    const { data: row, error: findErr } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (findErr || !row) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
    }

    const rec = row as { id: string; user_id: string; expires_at: string; used_at: string | null }
    if (rec.used_at) {
      return NextResponse.json({ error: 'This reset link was already used.' }, { status: 400 })
    }

    const exp = new Date(rec.expires_at).getTime()
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return NextResponse.json({ error: 'This reset link has expired. Request a new one.' }, { status: 400 })
    }

    const { error: updUserErr } = await supabase.auth.admin.updateUserById(rec.user_id, {
      password,
    })

    if (updUserErr) {
      console.error('[reset-password-confirm] updateUserById', updUserErr)
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === 'production'
              ? 'Could not update password.'
              : updUserErr.message || 'Could not update password.',
        },
        { status: 400 },
      )
    }

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', rec.id)

    const { data: userRes } = await supabase.auth.admin.getUserById(rec.user_id)
    const notifyEmail = userRes?.user?.email?.trim()
    if (notifyEmail) {
      try {
        await sendPasswordResetSuccessEmail(notifyEmail)
      } catch (e) {
        console.error('[reset-password-confirm] success email', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return jsonError500(e, 'reset-password-confirm')
  }
}

export const POST = withSecurityLogging('POST /api/auth/reset-password-confirm', postResetPasswordConfirm)
