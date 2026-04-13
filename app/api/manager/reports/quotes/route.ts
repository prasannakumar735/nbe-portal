import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { parseFiltersFromSearchParams } from '@/lib/reports/parseFilters'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { fetchQuotesReport } from '@/lib/reports/supabase-queries'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const data = await fetchQuotesReport(supabase, filters)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/manager/reports/quotes]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Failed to load quotes report' }, { status: 500 })
  }
}
