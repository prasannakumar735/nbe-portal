import { NextResponse } from 'next/server'

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

const GENERIC_500 = 'Something went wrong. Please try again later.'

/**
 * Log full error server-side; return a safe message to clients in production
 * so stack traces, DB shapes, and paths are not exposed.
 */
export function jsonError500(caught: unknown, logLabel: string): NextResponse {
  console.error(`[api:${logLabel}]`, caught)
  const message = isProd() ? GENERIC_500 : caught instanceof Error ? caught.message : String(caught)
  return NextResponse.json({ error: message }, { status: 500 })
}

/**
 * Use for catch blocks where status may be 4xx or 5xx — hide internal details for 500+ in production.
 */
export function jsonFromCaught(caught: unknown, logLabel: string, status = 500): NextResponse {
  console.error(`[api:${logLabel}]`, caught)
  if (status >= 500 && isProd()) {
    return NextResponse.json({ error: GENERIC_500 }, { status })
  }
  const message = caught instanceof Error ? caught.message : String(caught)
  return NextResponse.json({ error: message }, { status })
}
