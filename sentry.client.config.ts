import * as Sentry from '@sentry/nextjs'

import { getSentryDsn } from '@/lib/sentry.dsn'

const dsn = getSentryDsn()

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV ?? 'development',

  // Minimal client overhead: errors + optional low sample tracing
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,

  // Security / auth issues only — no session replay by default
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  beforeSend(event) {
    // Drop if DSN was removed at runtime
    if (!getSentryDsn()) return null
    return event
  },
})
