import { NextResponse } from 'next/server'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { verifyEngagementTrackingToken } from '@/lib/sales/engagement/engagementTrackingToken'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    const payload = verifyEngagementTrackingToken(token)
    const supabase = createServiceRoleClient()
    await recordCampaignEngagementEvent(supabase, {
      campaignId: payload.campaignId,
      contactId: payload.contactId,
      generatedEmailId: payload.generatedEmailId,
      eventType: 'unsubscribed',
      source: 'unsubscribe_link',
      idempotencyKey: `unsub:${payload.contactId}:${payload.campaignId}`,
    })

    return new NextResponse(
      '<!DOCTYPE html><html><body><p>You have been unsubscribed from this campaign.</p></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  } catch {
    return new NextResponse('Invalid or expired unsubscribe link.', { status: 400 })
  }
}
