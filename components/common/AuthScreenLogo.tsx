/**
 * Logo used on auth shells (/login, forgot password, etc.).
 * SVG + Tailwind alone can briefly paint huge before CSS applies — explicit attrs + inline caps prevent full-screen flashes.
 *
 * `legacy` — larger mark for client portal flows (`?next=/client…`); same asset as staff default.
 */
export function AuthScreenLogo({
  className = '',
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'legacy'
}) {
  if (variant === 'legacy') {
    return (
      <img
        src="/NBE_LOGO_BK_PL.png"
        alt="NBE Australia"
        width={280}
        height={163}
        decoding="async"
        className={`h-16 w-auto max-h-16 max-w-[min(300px,92vw)] object-contain object-center ${className}`}
        style={{ maxHeight: '4rem', maxWidth: 'min(300px, 92vw)' }}
      />
    )
  }

  return (
    <img
      src="/NBE_LOGO_BK_PL.png"
      alt="NBE Australia"
      width={160}
      height={93}
      decoding="async"
      className={`h-14 w-auto max-h-14 max-w-[min(200px,90vw)] object-contain ${className}`}
      style={{ maxHeight: '3.5rem', maxWidth: 'min(200px, 90vw)' }}
    />
  )
}
