import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createAnonServerClient, createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { sanitizePlainText } from '@/lib/validation/safeText'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import { getClientIp } from '@/lib/security/rateLimitEdge'
import { forgotPasswordBodySchema } from '@/lib/security/schemas/authSchemas'
import { isTurnstileEnforced } from '@/lib/security/turnstileConfig'
import { verifyTurnstileToken } from '@/lib/security/verifyTurnstile'
import { withSecurityLogging, type ApiSecurityBinding, type SecurityRequest } from '@/lib/security/withSecurityLogging'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

const FORGOT_COOLDOWN_MS = 60_000
const lastForgotByEmail = new Map<string, number>()

/**
 * When Graph/custom mail fails, optionally fall back to Supabase's built-in recovery email
 * (`noreply@mail.app.supabase.io`). In production this defaults to **false** so misconfigured
 * Graph does not silently send Supabase-branded mail. Set `PASSWORD_RESET_ALLOW_SUPABASE_FALLBACK=true`
 * to allow fallback (e.g. emergency).
 */
function allowSupabasePasswordFallback(): boolean {
  const v = process.env.PASSWORD_RESET_ALLOW_SUPABASE_FALLBACK?.trim().toLowerCase()
  if (v === 'true') return true
  if (v === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Supabase-hosted recovery email (no Graph). Reset page handles PASSWORD_RECOVERY without ?token=. */
async function trySupabaseRecoveryEmail(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const anon = createAnonServerClient()
    const redirectTo = `${publicAppBaseUrl()}/reset-password`
    const { error: recErr } = await anon.auth.resetPasswordForEmail(email, { redirectTo })
    if (recErr) return { ok: false, message: recErr.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

async function postForgotPassword(request: SecurityRequest, _sec: ApiSecurityBinding) {
  try {
    assertJsonContentLength(request, 16_384)
    const rawBody = await request.json().catch(() => null)
    const parsed = forgotPasswordBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
    }
    const email = sanitizePlainText(parsed.data.email, 320).trim().toLowerCase()

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

    const now = Date.now()
    const last = lastForgotByEmail.get(email) ?? 0
    if (now - last < FORGOT_COOLDOWN_MS) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists for that email, a reset message was sent.',
      })
    }
    lastForgotByEmail.set(email, now)

    const supabase = createServiceRoleClient()

    let userId: string | null = null
    let page = 1
    const perPage = 200
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) {
        console.error('[forgot-password] listUsers', error)
        return NextResponse.json({ error: 'Unable to process request.' }, { status: 500 })
      }
      const found = data.users.find(u => u.email?.toLowerCase() === email)
      if (found?.id) {
        userId = found.id
        break
      }
      if (!data.users.length || data.users.length < perPage) break
      page += 1
      if (page > 50) break
    }

    if (!userId) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists for that email, a reset message was sent.',
      })
    }

    const plainToken = randomBytes(32).toString('hex')
    const tokenHash = hashToken(plainToken)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await supabase.from('password_reset_tokens').delete().eq('user_id', userId).is('used_at', null)

    const { error: insErr } = await supabase.from('password_reset_tokens').insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    if (insErr) {
      console.error('[forgot-password] insert token', insErr)
      if (allowSupabasePasswordFallback()) {
        const fb = await trySupabaseRecoveryEmail(email)
        if (fb.ok) {
          return NextResponse.json({
            success: true,
            message: 'If an account exists for that email, a reset message was sent.',
          })
        }
        console.error('[forgot-password] fallback resetPasswordForEmail', fb.message)
      }
      const payload =
        process.env.NODE_ENV === 'production'
          ? { error: 'Unable to create reset link.' }
          : {
              error: 'Unable to create reset link.',
              debug: insErr.message,
            }
      return NextResponse.json(payload, { status: 500 })
    }

    const resetUrl = `${publicAppBaseUrl()}/reset-password?token=${encodeURIComponent(plainToken)}`
    const html = [
      `Hi,<br/><br/>`,
      `You requested a password reset for the NBE Portal.<br/><br/>`,
      `<a href="${escapeHtml(resetUrl)}">Reset your password</a><br/><br/>`,
      `This link expires in <b>15 minutes</b>.<br/><br/>`,
      `If you did not request this, you can ignore this email.<br/><br/>`,
      `— NBE Team`,
    ].join('')

    try {
      await sendMailViaGraph({
        to: email,
        subject: 'NBE Portal — password reset',
        bodyHtml: html,
      })
    } catch (e) {
      console.error('[forgot-password] Graph send failed', e)
      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token_hash', tokenHash)

      if (allowSupabasePasswordFallback()) {
        const fb = await trySupabaseRecoveryEmail(email)
        if (fb.ok) {
          return NextResponse.json({
            success: true,
            message: 'If an account exists for that email, a reset message was sent.',
          })
        }
        console.error('[forgot-password] Supabase recovery after Graph failed', fb.message)
      }

      const graphMsg = e instanceof Error ? e.message : String(e)
      const payload =
        process.env.NODE_ENV === 'production'
          ? { error: 'Unable to send reset email.' }
          : {
              error: 'Unable to send reset email.',
              debug: graphMsg,
            }
      return NextResponse.json(payload, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for that email, a reset message was sent.',
    })
  } catch (e) {
    return jsonError500(e, 'forgot-password')
  }
}

export const POST = withSecurityLogging('POST /api/auth/forgot-password', postForgotPassword)
