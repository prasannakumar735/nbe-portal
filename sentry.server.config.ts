import * as Sentry from '@sentry/nextjs'

import { getSentryDsn } from '@/lib/sentry.dsn'

const dsn = getSentryDsn()

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,

  sendDefaultPii: false,

  beforeSend(event) {
    if (!getSentryDsn()) return null
    return event
  },
})
