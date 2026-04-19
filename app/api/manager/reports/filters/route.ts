import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireManagerReportsApi } from '@/lib/reports/api-auth'
import { getErrorMessage } from '@/lib/reports/errorMessage'
import { fetchFilterOptionsForPrivilegedReport } from '@/lib/reports/supabase-queries'
import {
  withSecurityLogging,
  type ApiSecurityBinding,
  type SecurityRequest,
} from '@/lib/security/withSecurityLogging'

export const runtime = 'nodejs'

async function getFilters(request: SecurityRequest, _sec: ApiSecurityBinding) {
  try {
    const supabase = await createServerClient()
    const gate = await requireManagerReportsApi(supabase, request)
    if (gate instanceof NextResponse) return gate

    const options = await fetchFilterOptionsForPrivilegedReport(supabase)
    console.info(
      `[GET /api/manager/reports/filters] returning clients=${options.clients.length} locations=${options.locations.length}`
    )
    return NextResponse.json(options)
  } catch (e) {
    console.error('[GET /api/manager/reports/filters]', e)
    return NextResponse.json({ error: getErrorMessage(e) || 'Failed to load filter options' }, { status: 500 })
  }
}

export const GET = withSecurityLogging('GET /api/manager/reports/filters', getFilters)
