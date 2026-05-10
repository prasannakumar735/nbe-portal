import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { localDateKeyYmd } from '@/lib/quotes/quoteNumberPolicy'
import { nextQuoteNumberFromDb, parseQuoteNumberRequestPrefix } from '@/lib/quotes/nextQuoteNumberFromDb'

/**
 * GET /api/quotes/next-number?prefix=RRD|SWD|IRD&dateKey=YYYYMMDD (optional; defaults to server local date if omitted)
 */
export async function GET(request: NextRequest) {
  try {
    await requirePortalStaff()

    const { searchParams } = new URL(request.url)
    const prefix = parseQuoteNumberRequestPrefix(searchParams.get('prefix'))
    if (!prefix) {
      return NextResponse.json({ error: 'Invalid or missing prefix (RRD, SWD, or IRD).' }, { status: 400 })
    }

    let dateKey = (searchParams.get('dateKey') ?? '').trim()
    if (!dateKey) {
      dateKey = localDateKeyYmd(new Date())
    }
    if (!/^\d{8}$/.test(dateKey)) {
      return NextResponse.json({ error: 'dateKey must be YYYYMMDD when provided.' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const quoteNumber = await nextQuoteNumberFromDb(supabase, prefix, dateKey)
    return NextResponse.json({ quoteNumber, prefix, dateKey })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to allocate quote number.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
