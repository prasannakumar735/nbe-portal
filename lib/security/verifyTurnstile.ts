type SiteverifyResponse = {
  success: boolean
  'error-codes'?: string[]
}

/**
 * Verifies a Turnstile token with Cloudflare. When `TURNSTILE_SECRET_KEY` is unset, returns
 * `{ ok: true }` (dev). When secret is set, token must be present and valid.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  remoteip: string | undefined,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) {
    return { ok: true }
  }
  const t = typeof token === 'string' ? token.trim() : ''
  if (!t) {
    return { ok: false, reason: 'captcha_required' }
  }

  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', t)
  if (remoteip && remoteip !== 'unknown') {
    body.set('remoteip', remoteip)
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })
    const data = (await res.json()) as SiteverifyResponse
    if (data.success) {
      return { ok: true }
    }
    return { ok: false, reason: 'captcha_failed' }
  } catch {
    return { ok: false, reason: 'captcha_unavailable' }
  }
}
