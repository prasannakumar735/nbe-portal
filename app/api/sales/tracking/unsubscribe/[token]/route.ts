import { NextResponse } from 'next/server'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { verifyUnsubscribeToken } from '@/lib/sales/engagement/engagementTrackingToken'
import { addSalesEmailSuppression } from '@/lib/sales/repositories/salesEmailSuppressionRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ token: string }> }

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function page(bodyHtml: string, status = 200): NextResponse {
  const html = [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="robots" content="noindex, nofollow" />',
    '<title>Unsubscribe — NBE</title>',
    '<style>body{font-family:Arial,Helvetica,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.25rem;color:#222;line-height:1.5}',
    'button{font-size:1rem;padding:.7rem 1.2rem;border:0;border-radius:4px;background:#b3271e;color:#fff;cursor:pointer}',
    'p{margin:0 0 1rem}small{color:#666}</style></head><body>',
    bodyHtml,
    '</body></html>',
  ].join('')

  return new NextResponse(html, {
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
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    const payload = verifyUnsubscribeToken(token)

    const supabase = createServiceRoleClient()
    const contacts = await listSalesContactsByIds(supabase, [payload.contactId])
    const email = contacts[0]?.email?.trim()

    return page(
      [
        '<h1>Unsubscribe</h1>',
        email
          ? `<p>Stop receiving sales emails from NBE at <strong>${escapeHtml(email)}</strong>?</p>`
          : '<p>Stop receiving sales emails from NBE?</p>',
        `<form method="POST" action="">`,
        '<button type="submit">Yes, unsubscribe me</button>',
        '</form>',
        '<p><small>You can close this page if you did not mean to unsubscribe.</small></p>',
      ].join(''),
    )
  } catch {
    return page('<h1>Unsubscribe</h1><p>This unsubscribe link is not valid.</p>', 400)
  }
}

/** Performs the opt-out. Idempotent — repeat POSTs are safe. */
export async function POST(_request: Request, context: RouteContext) {
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

    return page(
      [
        '<h1>You have been unsubscribed</h1>',
        '<p>You will not receive further sales emails from NBE.</p>',
        '<p><small>NBE Australia Pty Ltd — 22A Humeside Drive, Campbellfield VIC 3061</small></p>',
      ].join(''),
    )
  } catch {
    return page('<h1>Unsubscribe</h1><p>This unsubscribe link is not valid.</p>', 400)
  }
}
