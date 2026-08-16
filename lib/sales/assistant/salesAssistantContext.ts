import type { SupabaseClient } from '@supabase/supabase-js'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { getSalesPipelineOpportunityById } from '@/lib/sales/repositories/salesPipelineOpportunityRepository'
import { getSalesContactEngagement } from '@/lib/sales/repositories/salesContactEngagementRepository'
import { listSalesGeneratedEmailsByCampaign } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type { SalesAssistantContextSnapshot } from '@/lib/sales/types/salesAssistant.types'

function excerpt(text: string, max = 400): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export async function loadSalesAssistantContext(
  supabase: SupabaseClient,
  input: {
    businessId: string
    contactId?: string | null
    campaignId?: string | null
    opportunityId?: string | null
  },
): Promise<SalesAssistantContextSnapshot> {
  const business = await getSalesBusinessById(supabase, input.businessId)

  let contact: SalesAssistantContextSnapshot['contact'] = null
  if (input.contactId) {
    const rows = await listSalesContactsByIds(supabase, [input.contactId])
    const row = rows[0]
    if (row) {
      contact = {
        id: row.id,
        email: row.email,
        verificationStatus: row.verification_status,
      }
    }
  }

  let campaign: SalesAssistantContextSnapshot['campaign'] = null
  if (input.campaignId) {
    const row = await getSalesCampaignById(supabase, input.campaignId)
    if (row) {
      campaign = { id: row.id, name: row.name, status: row.status }
    }
  }

  let pipeline: SalesAssistantContextSnapshot['pipeline'] = null
  if (input.opportunityId) {
    const row = await getSalesPipelineOpportunityById(supabase, input.opportunityId)
    if (row) {
      pipeline = {
        id: row.id,
        stage: row.stage,
        title: row.title,
        revenueCents: row.revenue_cents,
        probabilityPercent: row.probability_percent,
        notes: row.notes,
      }
    }
  }

  let engagement: SalesAssistantContextSnapshot['engagement'] = null
  if (input.contactId && input.campaignId) {
    const row = await getSalesContactEngagement(supabase, {
      contact_id: input.contactId,
      campaign_id: input.campaignId,
    })
    if (row) {
      engagement = {
        replyDetected: row.reply_detected,
        opened: row.opened,
        followupCount: row.followup_count,
      }
    }
  }

  const recentEmails: SalesAssistantContextSnapshot['recentEmails'] = []
  if (input.campaignId && input.contactId) {
    const emails = await listSalesGeneratedEmailsByCampaign(supabase, input.campaignId, {
      contactId: input.contactId,
    })
    for (const email of emails.slice(0, 5)) {
      recentEmails.push({
        subject: email.subject,
        status: email.status,
        excerpt: excerpt(email.body),
      })
    }
  }

  return {
    business: business
      ? {
          id: business.id,
          companyName: business.company_name,
          suburb: business.suburb,
          postcode: business.postcode,
          category: business.category,
          website: business.website,
        }
      : null,
    contact,
    campaign,
    pipeline,
    engagement,
    recentEmails,
  }
}

export function formatAssistantContextBlock(ctx: SalesAssistantContextSnapshot): string {
  const lines: string[] = ['## CRM context (read-only)']
  if (ctx.business) {
    lines.push(
      `Business: ${ctx.business.companyName} (${ctx.business.postcode})`,
      `Category: ${ctx.business.category ?? 'unknown'}`,
      `Suburb: ${ctx.business.suburb ?? '—'}`,
      `Website: ${ctx.business.website ?? '—'}`,
    )
  }
  if (ctx.contact) {
    lines.push(`Contact email: ${ctx.contact.email ?? '—'} (${ctx.contact.verificationStatus})`)
  }
  if (ctx.campaign) {
    lines.push(`Campaign: ${ctx.campaign.name} (${ctx.campaign.status})`)
  }
  if (ctx.pipeline) {
    lines.push(
      `Pipeline: ${ctx.pipeline.title} — stage ${ctx.pipeline.stage}, probability ${ctx.pipeline.probabilityPercent}%, revenue cents ${ctx.pipeline.revenueCents}`,
      `Pipeline notes: ${ctx.pipeline.notes || '(none)'}`,
    )
  }
  if (ctx.engagement) {
    lines.push(
      `Engagement: reply=${ctx.engagement.replyDetected}, opened=${ctx.engagement.opened}, follow-ups sent=${ctx.engagement.followupCount}`,
    )
  }
  if (ctx.recentEmails.length > 0) {
    lines.push('', '## Recent outbound emails (NBE — not the prospect reply)')
    for (const e of ctx.recentEmails) {
      lines.push(`- [${e.status}] ${e.subject}: ${e.excerpt}`)
    }
  }
  return lines.join('\n')
}
