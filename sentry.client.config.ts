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

  enableLogs: process.env.NODE_ENV === 'production',
  integrations: [
    browserTracingIntegration(),
    ...(process.env.NODE_ENV === 'production' ? [browserProfilingIntegration()] : []),
    ...(process.env.NODE_ENV === 'production'
      ? [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })]
      : []),
  ],
  tracePropagationTargets: clientTracePropagationTargets(),

  // Security / auth issues only — no session replay by default
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  beforeSend(event) {
    if (!getSentryDsn()) return null
    if (process.env.NODE_ENV !== 'production') return null
    const chunks: string[] = []
    if (event.message) chunks.push(String(event.message))
    for (const ex of event.exception?.values ?? []) {
      if (ex.value) chunks.push(ex.value)
    }
    const blob = chunks.join(' ')
    if (/hydrat/i.test(blob) && /didn't match|did not match|mismatch/i.test(blob)) {
      return null
    }
    return event
  },
})
