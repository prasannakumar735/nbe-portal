import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  computePromptPerformanceSnapshots,
  persistPromptPerformanceSnapshots,
} from '@/lib/sales/engagement/campaignEngagementAnalytics'
import { promptEngagementMetricsQuerySchema } from '@/lib/sales/validators/engagement.validators'



export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = promptEngagementMetricsQuerySchema.parse({
      campaignId: searchParams.get('campaignId') ?? undefined,
      persist: searchParams.get('persist') ?? undefined,
    })
    const snapshots = await computePromptPerformanceSnapshots(auth.supabase, {
      campaignId: parsed.campaignId,
    })
    const written = parsed.persist
      ? await persistPromptPerformanceSnapshots(auth.supabase, snapshots)
      : 0
    return ok({ snapshots, metricsSnapshotsWritten: written })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Metrics failed', 500)
  }
}
