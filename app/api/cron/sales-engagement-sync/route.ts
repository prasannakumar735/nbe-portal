import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { syncCampaignEngagementFromDeliveryArtifacts } from '@/lib/sales/engagement/syncDeliveryEngagement'
import { listSalesEmailSendQueue } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'


export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const supabase = createServiceRoleClient()
    const campaignId = request.nextUrl.searchParams.get('campaignId')

    if (campaignId) {
      const result = await syncCampaignEngagementFromDeliveryArtifacts(supabase, campaignId)
      return NextResponse.json({ ok: true, campaignId, ...result })
    }

    const queues = await listSalesEmailSendQueue(supabase, { limit: 500 })
    const campaignIds = [...new Set(queues.map((q) => q.campaign_id))]
    const results: Record<string, Awaited<ReturnType<typeof syncCampaignEngagementFromDeliveryArtifacts>>> =
      {}
    for (const id of campaignIds) {
      results[id] = await syncCampaignEngagementFromDeliveryArtifacts(supabase, id)
    }
    return NextResponse.json({ ok: true, campaigns: campaignIds.length, results })
  } catch (e) {
    return jsonError500(e, 'sales-engagement-sync-cron')
  }
}
