/**
 * DSN for Sentry — server/edge use `SENTRY_DSN`; browser needs `NEXT_PUBLIC_SENTRY_DSN`
 * (the public key in the DSN is not a secret, but separate envs keep intent clear).
 */
export function getSentryDsn(): string | undefined {
  const dsn = (process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? '').trim()
  return dsn || undefined
}

/**
 * Performance trace sampling (0–1). Set `SENTRY_TRACES_SAMPLE_RATE` to override.
 * Default: 1 in non-production (wizard / verification), 0.2 in production (adjust as needed).
 */
export function getSentryTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE?.trim()
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  }
  return process.env.NODE_ENV === 'production' ? 0.2 : 1
}

/**
 * Profiling session sampling (0–1). Set `SENTRY_PROFILE_SESSION_SAMPLE_RATE` to override.
 * Requires tracing (`tracesSampleRate` / sampler). Default: 1 in dev, 0.1 in production.
 */
export function getSentryProfileSessionSampleRate(): number {
  const raw = process.env.SENTRY_PROFILE_SESSION_SAMPLE_RATE?.trim()
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  }
  return process.env.NODE_ENV === 'production' ? 0.1 : 1
}
