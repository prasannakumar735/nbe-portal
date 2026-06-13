import { NextRequest, NextResponse } from 'next/server'

/** Returns 401 response if cron auth fails; otherwise null. */
export function assertCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get('authorization')?.trim() ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
