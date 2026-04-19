import { browserProfilingIntegration, browserTracingIntegration } from '@sentry/browser'
import * as Sentry from '@sentry/nextjs'

import {
  getSentryDsn,
  getSentryProfileSessionSampleRate,
  getSentryTracesSampleRate,
} from '@/lib/sentry.dsn'

const dsn = getSentryDsn()

function clientTracePropagationTargets(): (string | RegExp)[] {
  const targets: (string | RegExp)[] = ['localhost', /^https?:\/\/localhost(:\d+)?\/?/]
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) return targets
  try {
    const { origin, hostname } = new URL(site)
    if (hostname !== 'localhost') {
      targets.push(origin)
    }
  } catch {
    /* ignore invalid NEXT_PUBLIC_SITE_URL */
  }
  return targets
}

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV ?? 'development',

  tracesSampleRate: getSentryTracesSampleRate(),
  profileSessionSampleRate: getSentryProfileSessionSampleRate(),
  profileLifecycle: 'trace',

  enableLogs: true,
  integrations: [
    browserTracingIntegration(),
    browserProfilingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  tracePropagationTargets: clientTracePropagationTargets(),

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
