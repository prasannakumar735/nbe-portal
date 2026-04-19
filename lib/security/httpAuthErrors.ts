import { NextResponse } from 'next/server'

import { ForbiddenError, UnauthorizedError } from './errors'

/** Map auth helper errors to JSON responses; return null if unrelated. */
export function unauthorizedOrForbiddenResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
