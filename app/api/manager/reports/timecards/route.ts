import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { parseFiltersFromSearchParams, parseGroupBy } from '@/lib/reports/parseFilters'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { fetchTimecardReport } from '@/lib/reports/supabase-queries'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase, request)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const groupBy = parseGroupBy(sp.group)
    const data = await fetchTimecardReport(supabase, filters, groupBy)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/manager/reports/timecards]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Failed to load timecards' }, { status: 500 })
  }
}
