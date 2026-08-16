import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { verifyClickToken } from '@/lib/sales/engagement/engagementTrackingToken'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { engagementTrackingClickQuerySchema } from '@/lib/sales/validators/engagement.validators'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    const { searchParams } = new URL(request.url)
    const { url } = engagementTrackingClickQuerySchema.parse({
      url: searchParams.get('url'),
    })
    // Verifies signature AND that the destination URL matches the hash signed
    // into the token, preventing open redirect.
    const payload = verifyClickToken(token, url)

    const supabase = createServiceRoleClient()
    await recordCampaignEngagementEvent(supabase, {
      campaignId: payload.campaignId,
      contactId: payload.contactId,
      generatedEmailId: payload.generatedEmailId,
      eventType: 'clicked',
      source: 'tracking_link',
      metadata: { targetUrl: url },
      idempotencyKey: `click:${payload.generatedEmailId}:${Buffer.from(url).toString('base64url').slice(0, 32)}`,
    })

    return NextResponse.redirect(url, 302)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid tracking link.' }, { status: 400 })
  }
}
