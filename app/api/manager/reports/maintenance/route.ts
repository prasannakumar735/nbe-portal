import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { parseFiltersFromSearchParams } from '@/lib/reports/parseFilters'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { fetchMaintenanceReport } from '@/lib/reports/supabase-queries'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)
    const rows = await fetchMaintenanceReport(supabase, filters)
    return NextResponse.json({ rows })
  } catch (e) {
    console.error('[GET /api/manager/reports/maintenance]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Failed to load maintenance report' }, { status: 500 })
  }
}
