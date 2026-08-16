import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  computePromptPerformanceSnapshots,
  getCampaignEngagementFunnel,
  persistPromptPerformanceSnapshots,
} from '@/lib/sales/engagement/campaignEngagementAnalytics'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { syncCampaignEngagementFromDeliveryArtifacts } from '@/lib/sales/engagement/syncDeliveryEngagement'
import { recordEngagementEventBodySchema } from '@/lib/sales/validators/engagement.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ campaignId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = await context.params
    const funnel = await getCampaignEngagementFunnel(auth.supabase, campaignId)
    return ok({ funnel })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load engagement', 500)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = await context.params
    const sync = await syncCampaignEngagementFromDeliveryArtifacts(auth.supabase, campaignId)
    const funnel = await getCampaignEngagementFunnel(auth.supabase, campaignId)
    const promptPerformance = await computePromptPerformanceSnapshots(auth.supabase, { campaignId })
    const persisted = await persistPromptPerformanceSnapshots(auth.supabase, promptPerformance)
    return ok({ sync, funnel, promptPerformance, metricsSnapshotsWritten: persisted })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Engagement sync failed', 500)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 8_192)
    const { campaignId } = await context.params
    const body = await request.json()
    const parsed = recordEngagementEventBodySchema.parse(body)
    if (parsed.campaignId !== campaignId) {
      return fail('campaignId mismatch.', 422)
    }
    const event = await recordCampaignEngagementEvent(auth.supabase, {
      campaignId: parsed.campaignId,
      contactId: parsed.contactId,
      eventType: parsed.eventType,
      source: parsed.source ?? 'api',
      generatedEmailId: parsed.generatedEmailId,
      queueId: parsed.queueId,
      occurredAt: parsed.occurredAt,
      metadata: parsed.metadata,
      idempotencyKey: parsed.idempotencyKey,
    })
    return ok({ event })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to record event', 500)
  }
}
