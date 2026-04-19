import * as Sentry from '@sentry/nextjs'

import { getSentryDsn, getSentryTracesSampleRate } from '@/lib/sentry.dsn'

const dsn = getSentryDsn()

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  tracesSampleRate: getSentryTracesSampleRate(),

  enableLogs: true,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] })],

  sendDefaultPii: false,

  beforeSend(event) {
    if (!getSentryDsn()) return null
    return event
  },
})
