import * as Sentry from '@sentry/nextjs'

import { getSentryDsn } from '@/lib/sentry.dsn'
import { redactIpForLogs } from '@/lib/security/redactIp'

/** Events mirrored to Sentry as `captureMessage` (no PII). */
const SENTRY_SECURITY_EVENTS = new Set([
  'rate_limit_exceeded',
  'unauthorized_access',
  'forbidden_access',
  'invalid_payload',
  'payload_too_large',
  'bot_blocked',
  'suspicious_request',
  'session_required',
  'ip_blocked',
  'repeated_failures',
  'privilege_violation',
  'suspicious_access',
  // legacy aliases if any code still emits
  'api_auth_failure',
  'forbidden',
])

type SecuritySentryContext = {
  path?: string
  method?: string
  ip?: string
  user_agent?: string
  route_name?: string
  userId?: string
  http_status_code?: number
  monitoring?: { signal: string }
  detail?: string
  tier?: string
  reason?: string
}

/**
 * Sends a security signal to Sentry (alongside JSON logs). Disabled when `SENTRY_SECURITY_EVENTS=0`.
 */
export function captureSecurityEventSentry(
  event: string,
  data: SecuritySentryContext,
  requestId?: string,
): void {
  if (process.env.SENTRY_SECURITY_EVENTS === '0') return
  if (!getSentryDsn()) return
  if (!SENTRY_SECURITY_EVENTS.has(event)) return

  const ipMasked = data.ip ? redactIpForLogs(data.ip) : undefined

  try {
    Sentry.captureMessage(`security:${event}`, {
      level: 'warning',
      tags: {
        security_event: event,
        ...(data.monitoring?.signal ? { monitoring_signal: data.monitoring.signal } : {}),
        ...(data.path ? { endpoint: data.path.slice(0, 200) } : {}),
      },
      extra: {
        path: data.path,
        method: data.method,
        ip_masked: ipMasked,
        user_agent: data.user_agent,
        route_name: data.route_name,
        user_id: data.userId,
        http_status_code: data.http_status_code,
        reason: data.reason,
        detail: data.detail,
        tier: data.tier,
        request_id: requestId,
        correlation_id: requestId,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      },
      fingerprint: [event, data.path ?? '', data.monitoring?.signal ?? 'none'],
    })
  } catch {
    // Never block request handling on telemetry failure
  }
}
