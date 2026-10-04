import { NextResponse } from 'next/server'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { verifyEngagementTrackingToken } from '@/lib/sales/engagement/engagementTrackingToken'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'



const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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
      eventType: 'opened',
      source: 'tracking_pixel',
      idempotencyKey: `open:${payload.generatedEmailId}:${new Date().toISOString().slice(0, 13)}`,
    })
  } catch {
    // Always return pixel — do not leak validation errors to recipients.
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
