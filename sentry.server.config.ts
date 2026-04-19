import { nodeProfilingIntegration } from '@sentry/profiling-node'
import * as Sentry from '@sentry/nextjs'

import {
  getSentryDsn,
  getSentryProfileSessionSampleRate,
  getSentryTracesSampleRate,
} from '@/lib/sentry.dsn'

const dsn = getSentryDsn()

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  tracesSampleRate: getSentryTracesSampleRate(),
  profileSessionSampleRate: getSentryProfileSessionSampleRate(),
  profileLifecycle: 'trace',

  enableLogs: true,
  integrations: [
    nodeProfilingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],

  sendDefaultPii: false,

  beforeSend(event) {
    if (!getSentryDsn()) return null
    return event
  },
})
