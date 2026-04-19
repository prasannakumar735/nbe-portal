/**
 * DSN for Sentry — server/edge use `SENTRY_DSN`; browser needs `NEXT_PUBLIC_SENTRY_DSN`
 * (the public key in the DSN is not a secret, but separate envs keep intent clear).
 */
export function getSentryDsn(): string | undefined {
  const dsn = (process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? '').trim()
  return dsn || undefined
}
