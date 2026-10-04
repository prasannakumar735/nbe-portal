import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { buildSalesAnalyticsDashboard } from '@/lib/sales/analytics/salesAnalyticsService'



export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const dashboard = await buildSalesAnalyticsDashboard(auth.supabase)
    return ok({ dashboard })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load analytics', 500)
  }
}
