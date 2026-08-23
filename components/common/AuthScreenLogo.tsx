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
        className={`h-16 w-auto object-contain object-center ${className}`}
      />
    )
  }

  return (
    <img
      src="/Portal_logo.png"
      alt="NBE Portal"
      width={240}
      height={140}
      decoding="async"
      className={`h-24 w-auto object-contain ${className}`}
    />
  )
}
