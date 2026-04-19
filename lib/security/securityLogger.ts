import { recordFailure } from '@/lib/security/ipBlocker'
import { getCorrelationIdFromRequest } from '@/lib/security/requestIdentity'
import { redactIpForLogs } from '@/lib/security/redactIp'
import { captureSecurityEventSentry } from '@/lib/security/securitySentry'

/** Correlation + Sentry context only — standard `Request` / `NextRequest` both qualify. */
export type SecurityLogRequestRef = { headers: Headers } | null

const LOG_SCHEMA_VERSION = '1'

/** Stable names for log drains / SIEM alert rules (filter on `monitoring.signal`). */
export type MonitoringSignal =
  | 'rate_limit'
  | 'rate_limit_429'
  | 'bot_block'
  | 'session_required_redirect'
  | 'api_unauthorized_401'
  | 'api_forbidden_403'
  | 'suspicious_request'
  | 'malformed_request'
  | 'payload_too_large'
  | 'ip_blocked'
  | 'repeated_failures'
  | 'privilege_violation'
  | 'suspicious_access'

export type SecurityLogEvent =
  | 'rate_limit_exceeded'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_payload'
  | 'suspicious_request'
  | 'bot_blocked'
  | 'session_required'
  | 'api_auth_failure'
  | 'unauthorized_access'
  | 'forbidden_access'
  | 'payload_too_large'
  | 'ip_blocked'
  | 'repeated_failures'
  | 'privilege_violation'
  | 'suspicious_access'

/**
 * Additional fields for `logSecurityEvent` — use only low-cardinality, non-sensitive values.
 * Do not pass tokens, passwords, cookies, Authorization headers, or full email addresses.
 */
export type SecurityEventData = {
  path?: string
  method?: string
  /** Raw IP; emitted masked as `ip` in the log line. */
  ip?: string
  /** Truncated User-Agent (middleware / API). */
  user_agent?: string
  /** Human-readable route label (e.g. `GET /api/manager/reports/filters`). */
  route_name?: string
  /** Middleware-generated or upstream request id (also read from `x-nbe-request-id`). */
  correlation_id?: string
  /** Authenticated Supabase `auth.users` id when known (e.g. 403 after identity established). */
  userId?: string
  http_status_code?: number
  monitoring?: { signal: MonitoringSignal }
  detail?: string
  tier?: string
  reason?: string
  /** Optional facets for SIEM (string values only; no PII). */
  labels?: Record<string, string>
}

export type SecurityLogPayload = {
  event: SecurityLogEvent
  monitoring?: { signal: MonitoringSignal }
  path?: string
  method?: string
  http_status_code?: number
  ip?: string
  userId?: string
  user_agent?: string
  route_name?: string
  correlation_id?: string
  detail?: string
  tier?: string
  reason?: string
  labels?: Record<string, string>
}

function headersFromMaybeRequest(
  request?: SecurityLogRequestRef | Headers | null,
): { headers: Headers } | undefined {
  if (!request) return undefined
  if ('headers' in request && request.headers instanceof Headers) return request
  if (request instanceof Headers) return { headers: request }
  return undefined
}

function requestCorrelation(
  request?: SecurityLogRequestRef | Headers | null,
  correlationOverride?: string,
) {
  const src = headersFromMaybeRequest(request ?? undefined)
  const rid = correlationOverride?.trim() || (src ? getCorrelationIdFromRequest(src) : undefined)
  return rid ? { request_id: rid } : {}
}

/**
 * Central security audit line — **one JSON object per call** on stderr.
 * Use for alerting on 401/429 spikes, abusive IPs, and malformed requests.
 *
 * @param event — Short event name (e.g. `rate_limit_exceeded`, `bot_blocked`).
 * @param data — Path, method, masked IP, optional userId, HTTP status, reasons (no secrets).
 */
export function logSecurityEvent(
  event: string,
  data: SecurityEventData = {},
  request?: SecurityLogRequestRef,
): void {
  const ipMasked = data.ip ? redactIpForLogs(data.ip) : undefined
  const correlationId = data.correlation_id?.trim() || (request ? getCorrelationIdFromRequest(request) : undefined)
  const correlation = requestCorrelation(request ?? undefined, correlationId)
  const requestId =
    'request_id' in correlation && typeof correlation.request_id === 'string'
      ? correlation.request_id
      : undefined

  const line = JSON.stringify({
    service: 'nbe-portal',
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    schema: 'nbe.security',
    schema_version: LOG_SCHEMA_VERSION,
    event,
    path: data.path,
    method: data.method,
    ip: ipMasked,
    user_agent: data.user_agent,
    route_name: data.route_name,
    userId: data.userId,
    http_status_code: data.http_status_code,
    monitoring: data.monitoring,
    detail: data.detail,
    tier: data.tier,
    reason: data.reason,
    labels: data.labels,
    timestamp: new Date().toISOString(),
    ...correlation,
  })

  console.warn(line)

  captureSecurityEventSentry(event, data, requestId)
}

/**
 * Typed wrapper around {@link logSecurityEvent} for legacy call sites.
 * Prefer `logSecurityEvent` for new code.
 */
export function securityLog(payload: SecurityLogPayload, request?: SecurityLogRequestRef) {
  const { event, ...rest } = payload
  logSecurityEvent(event, rest, request)
}

/** API returned 401 — unauthenticated or invalid session. */
export function securityLogApiUnauthorized(
  input: {
    path: string
    method: string
    ip?: string
    reason?: string
    userId?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'unauthorized_access',
    {
      monitoring: { signal: 'api_unauthorized_401' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      userId: input.userId,
      http_status_code: 401,
      reason: input.reason,
      detail: 'api_401',
    },
    request,
  )
  if (input.ip) {
    void recordFailure(input.ip).catch(() => {})
  }
}

/** Malformed body / validation failure (400) — abusive or broken clients. */
export function securityLogInvalidPayload(
  input: {
    path: string
    method: string
    ip?: string
    reason?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'invalid_payload',
    {
      monitoring: { signal: 'malformed_request' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      http_status_code: 400,
      reason: input.reason,
      detail: 'invalid_body_or_schema',
    },
    request,
  )
}

/** API returned 403 — authenticated but not allowed (optionally log `userId` of caller). */
export function securityLogApiForbidden(
  input: {
    path: string
    method: string
    ip?: string
    reason?: string
    userId?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'forbidden_access',
    {
      monitoring: { signal: 'api_forbidden_403' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      userId: input.userId,
      http_status_code: 403,
      reason: input.reason,
      detail: 'api_403',
    },
    request,
  )
  if (input.ip) {
    void recordFailure(input.ip).catch(() => {})
  }
  if (input.userId) {
    securityLogPrivilegeViolation(
      {
        path: input.path,
        method: input.method,
        userId: input.userId,
        ip: input.ip,
        reason: input.reason,
        user_agent: input.user_agent,
        route_name: input.route_name,
        correlation_id: input.correlation_id,
      },
      request,
    )
  }
}

/** Request body over limit (413). */
export function securityLogPayloadTooLarge(
  input: {
    path: string
    method: string
    ip?: string
    reason?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'payload_too_large',
    {
      monitoring: { signal: 'payload_too_large' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      http_status_code: 413,
      reason: input.reason,
      detail: 'content_length_exceeded',
    },
    request,
  )
}

/** IP is temporarily blocked after repeated failures (see `lib/security/ipBlocker.ts`). */
export function securityLogIpBlocked(
  input: {
    path: string
    method: string
    ip?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'ip_blocked',
    {
      monitoring: { signal: 'ip_blocked' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      http_status_code: 429,
      detail: 'ip_temp_ban',
    },
    request,
  )
}

/** Authenticated user attempted action their role does not allow (403). Never log secrets or tokens. */
export function securityLogPrivilegeViolation(
  input: {
    path: string
    method: string
    userId?: string
    ip?: string
    reason?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'privilege_violation',
    {
      monitoring: { signal: 'privilege_violation' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      userId: input.userId,
      http_status_code: 403,
      reason: input.reason,
      detail: 'rbac_forbidden',
    },
    request,
  )
}

/** Heuristic “suspicious” client behaviour (tune call sites; do not log bodies). */
export function securityLogSuspiciousAccess(
  input: {
    path: string
    method: string
    ip?: string
    reason?: string
    user_agent?: string
    route_name?: string
    correlation_id?: string
    userId?: string
  },
  request?: SecurityLogRequestRef,
) {
  logSecurityEvent(
    'suspicious_access',
    {
      monitoring: { signal: 'suspicious_access' },
      path: input.path,
      method: input.method,
      ip: input.ip,
      user_agent: input.user_agent,
      route_name: input.route_name,
      correlation_id: input.correlation_id,
      userId: input.userId,
      http_status_code: 400,
      reason: input.reason,
      detail: 'suspicious_access',
    },
    request,
  )
}
