import { NextResponse } from 'next/server'
import { renderUnsubscribePageHtml } from '@/lib/sales/compliance/unsubscribePageHtml'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { verifyUnsubscribeToken } from '@/lib/sales/engagement/engagementTrackingToken'
import { addSalesEmailSuppression } from '@/lib/sales/repositories/salesEmailSuppressionRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'



type RouteContext = { params: Promise<{ token: string }> }

function page(bodyHtml: string, status = 200): NextResponse {
  return new NextResponse(bodyHtml, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Never let a scanner or proxy prefetch turn into a state change.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

/**
 * Confirmation page only — deliberately does NOT unsubscribe.
 *
 * Mail security scanners (Outlook SafeLinks, antivirus gateways) prefetch links
 * in email, so a GET that mutated state would silently unsubscribe contacts who
 * never clicked. The button below POSTs to perform the opt-out.
 *
 * ?cancel=1 shows the "no changes made" confirmation when the user clicks
 * "Keep me subscribed" — still a GET so no state is mutated.
 */
export async function GET(request: Request, context: RouteContext) {
  const nonce = request.headers.get('x-nonce') ?? undefined
  try {
    const { token } = await context.params
    const payload = verifyUnsubscribeToken(token)

    const url = new URL(request.url)
    if (url.searchParams.get('cancel') === '1') {
      return page(renderUnsubscribePageHtml({ kind: 'cancelled' }, nonce))
    }

    const supabase = createServiceRoleClient()
    const contacts = await listSalesContactsByIds(supabase, [payload.contactId])
    const email = contacts[0]?.email?.trim()

    return page(renderUnsubscribePageHtml({ kind: 'confirm', email }, nonce))
  } catch {
    return page(renderUnsubscribePageHtml({ kind: 'invalid' }, nonce), 400)
  }
}

/** Performs the opt-out. Idempotent — repeat POSTs are safe. */
export async function POST(request: Request, context: RouteContext) {
  const nonce = request.headers.get('x-nonce') ?? undefined
  try {
    const { token } = await context.params
    const payload = verifyUnsubscribeToken(token)

    const supabase = createServiceRoleClient()
    const contacts = await listSalesContactsByIds(supabase, [payload.contactId])
    const email = contacts[0]?.email?.trim()

    // Write to the global suppression list first. This is the authoritative
    // do-not-email record — the engagement event below is secondary telemetry.
    // Both are idempotent, so repeat POSTs are safe.
    if (email) {
      await addSalesEmailSuppression(supabase, {
        email_address: email,
        reason: 'unsubscribed',
        contact_id: payload.contactId,
        campaign_id: payload.campaignId,
      })
    }

    await recordCampaignEngagementEvent(supabase, {
      campaignId: payload.campaignId,
      contactId: payload.contactId,
      generatedEmailId: payload.generatedEmailId,
      eventType: 'unsubscribed',
      source: 'unsubscribe_link',
      idempotencyKey: `unsub:${payload.contactId}:${payload.campaignId}`,
    })

    return page(renderUnsubscribePageHtml({ kind: 'done' }, nonce))
  } catch {
    return page(renderUnsubscribePageHtml({ kind: 'invalid' }, nonce), 400)
  }
}
