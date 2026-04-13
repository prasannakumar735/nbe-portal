import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { parseFiltersFromSearchParams } from '@/lib/reports/parseFilters'
import { fetchWorkTypesLevel1ForScope } from '@/lib/reports/supabase-queries'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase)
    if (gate instanceof NextResponse) return gate

    const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = parseFiltersFromSearchParams(sp)

    if (!filters.clientId || !filters.locationId) {
      return NextResponse.json({ workTypesLevel1: [] as const })
    }

    let queryClient = supabase
    try {
      const { createServiceRoleClient, getSupabaseUrlForServer } = await import('@/lib/supabase/serviceRole')
      if ((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() && getSupabaseUrlForServer()) {
        queryClient = createServiceRoleClient()
      }
    } catch {
      /* user JWT */
    }

    const workTypesLevel1 = await fetchWorkTypesLevel1ForScope(queryClient, filters, {
      clientId: filters.clientId,
      locationId: filters.locationId,
    })

    return NextResponse.json({ workTypesLevel1 })
  } catch (e) {
    console.error('[GET /api/manager/reports/work-types-scope]', e)
    return NextResponse.json(
      { error: getErrorMessage(e) || 'Failed to load work types' },
      { status: 500 }
    )
  }
}
