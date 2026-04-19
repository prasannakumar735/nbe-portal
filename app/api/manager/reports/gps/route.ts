import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { parseFiltersFromSearchParams } from '@/lib/reports/parseFilters'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { fetchGpsReport } from '@/lib/reports/supabase-queries'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase, request)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const includeCoords = sp.coords === '1' || sp.coords === 'true'
    const rows = await fetchGpsReport(supabase, filters, includeCoords)
    return NextResponse.json({ rows, includeCoords })
  } catch (e) {
    console.error('[GET /api/manager/reports/gps]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Failed to load GPS report' }, { status: 500 })
  }
}
