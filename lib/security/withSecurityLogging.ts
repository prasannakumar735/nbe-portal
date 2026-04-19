import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** App Router `Request` / `NextRequest` — avoid importing `Request` type alias clashes. */
export type SecurityRequest = NextRequest | Request

import { PayloadTooLargeError } from '@/lib/security/httpRequestLimits'
import { getClientIp } from '@/lib/security/rateLimitEdge'
import { getCorrelationIdFromRequest, truncateUserAgent } from '@/lib/security/requestIdentity'
import {
  securityLogApiForbidden,
  securityLogApiUnauthorized,
  securityLogInvalidPayload,
  securityLogPayloadTooLarge,
} from '@/lib/security/securityLogger'

/** Non-sensitive request fields for API security logging (Edge + Node). */
export type ApiSecurityContext = {
  path: string
  method: string
  ip: string | undefined
  user_agent: string | undefined
  route_name: string
  correlation_id: string | undefined
  environment: string
}

export function getApiSecurityContext(request: SecurityRequest, routeName?: string): ApiSecurityContext {
  const path = 'nextUrl' in request ? request.nextUrl.pathname : new URL(request.url).pathname
  return {
    path,
    method: request.method,
    ip: getClientIp(request),
    user_agent: truncateUserAgent(request.headers.get('user-agent')),
    route_name: routeName ?? `${request.method} ${path}`,
    correlation_id: getCorrelationIdFromRequest(request),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  }
}

/** Pre-bound helpers so handlers do not repeat context fields or risk logging secrets. */
export type ApiSecurityBinding = ApiSecurityContext & {
  logUnauthorized: (reason?: string, userId?: string) => void
  logForbidden: (reason?: string, userId?: string) => void
  logInvalidPayload: (reason?: string) => void
  logPayloadTooLarge: (reason?: string) => void
}

function createApiSecurityBinding(request: SecurityRequest, routeName: string): ApiSecurityBinding {
  const base = getApiSecurityContext(request, routeName)
  return {
    ...base,
    logUnauthorized: (reason?: string, userId?: string) => {
      securityLogApiUnauthorized(
        {
          path: base.path,
          method: base.method,
          ip: base.ip,
          reason,
          userId,
          user_agent: base.user_agent,
          route_name: base.route_name,
          correlation_id: base.correlation_id,
        },
        request,
      )
    },
    logForbidden: (reason?: string, userId?: string) => {
      securityLogApiForbidden(
        {
          path: base.path,
          method: base.method,
          ip: base.ip,
          reason,
          userId,
          user_agent: base.user_agent,
          route_name: base.route_name,
          correlation_id: base.correlation_id,
        },
        request,
      )
    },
    logInvalidPayload: (reason?: string) => {
      securityLogInvalidPayload(
        {
          path: base.path,
          method: base.method,
          ip: base.ip,
          reason,
          user_agent: base.user_agent,
          route_name: base.route_name,
          correlation_id: base.correlation_id,
        },
        request,
      )
    },
    logPayloadTooLarge: (reason?: string) => {
      securityLogPayloadTooLarge(
        {
          path: base.path,
          method: base.method,
          ip: base.ip,
          reason,
          user_agent: base.user_agent,
          route_name: base.route_name,
          correlation_id: base.correlation_id,
        },
        request,
      )
    },
  }
}

/**
 * Wraps a route handler with a stable `route_name`, shared security context, and optional
 * `PayloadTooLargeError` handling (logs + 413) without pulling in Node-only APIs.
 */
export function withSecurityLogging(
  routeName: string,
  handler: (request: SecurityRequest, sec: ApiSecurityBinding) => Promise<Response> | Response,
  options?: { handlePayloadTooLarge?: boolean },
): (request: SecurityRequest) => Promise<Response> {
  const handlePayloadTooLarge = options?.handlePayloadTooLarge !== false
  return async (request: SecurityRequest) => {
    const sec = createApiSecurityBinding(request, routeName)
    try {
      return await handler(request, sec)
    } catch (e) {
      if (handlePayloadTooLarge && e instanceof PayloadTooLargeError) {
        sec.logPayloadTooLarge('content_length')
        return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
      }
      throw e
    }
  }
}
