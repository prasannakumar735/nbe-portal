import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { getSalesPipelineDashboard } from '@/lib/sales/pipeline/pipelineService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const dashboard = await getSalesPipelineDashboard(auth.supabase)
    return ok({ dashboard })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load dashboard', 500)
  }
}
