/**
 * Cloudflare Turnstile — free CAPTCHA. When **both** env vars are set, verification is enforced
 * on login and forgot-password. Omit either for local dev without Turnstile.
 */
export function isTurnstileEnforced(): boolean {
  const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  return Boolean(site && secret)
}
