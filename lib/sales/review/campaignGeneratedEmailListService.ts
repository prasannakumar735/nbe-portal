import type { SupabaseClient } from '@supabase/supabase-js'
import { getSalesEmailQualityScoreByGeneratedEmailId } from '@/lib/sales/repositories/salesEmailQualityRepository'
import { listLatestSalesGeneratedEmailsByCampaign } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import type { SalesGeneratedEmailStatus } from '@/lib/sales/constants/generatedEmailStatuses'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'
import type { SalesEmailQualityScore } from '@/lib/sales/types/emailQuality.types'
import type { SalesContactEngagement } from '@/lib/sales/types/contactEngagement.types'
import { listSalesContactEngagementByCampaign } from '@/lib/sales/repositories/salesContactEngagementRepository'

export type ContactEngagementSummary = Pick<
  SalesContactEngagement,
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'reply_detected'
  | 'bounce_detected'
  | 'unsubscribed'
>

export type CampaignGeneratedEmailRow = SalesGeneratedEmail & {
  contactEmail: string | null
  companyName: string | null
  quality: SalesEmailQualityScore | null
  engagement: ContactEngagementSummary | null
}

export async function listCampaignGeneratedEmailReviewRows(
  supabase: SupabaseClient,
  campaignId: string,
  options?: { status?: SalesGeneratedEmailStatus },
): Promise<CampaignGeneratedEmailRow[]> {
  const emails = await listLatestSalesGeneratedEmailsByCampaign(supabase, campaignId, options)
  if (emails.length === 0) return []

  const contactIds = [...new Set(emails.map((e) => e.contact_id))]
  const contacts = await listSalesContactsByIds(supabase, contactIds)
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  const businessIds = [...new Set(contacts.map((c) => c.business_id))]
  const businessNames = new Map<string, string>()
  await Promise.all(
    businessIds.map(async (id) => {
      const biz = await getSalesBusinessById(supabase, id)
      if (biz) businessNames.set(id, biz.company_name)
    }),
  )

  const engagementRows = await listSalesContactEngagementByCampaign(supabase, campaignId)
  const engagementByContact = new Map(engagementRows.map((e) => [e.contact_id, e]))

  const rows: CampaignGeneratedEmailRow[] = []
  for (const email of emails) {
    const contact = contactById.get(email.contact_id)
    const quality = await getSalesEmailQualityScoreByGeneratedEmailId(supabase, email.id)
    const eng = engagementByContact.get(email.contact_id)
    rows.push({
      ...email,
      contactEmail: contact?.email ?? null,
      companyName: contact ? businessNames.get(contact.business_id) ?? null : null,
      quality,
      engagement: eng
        ? {
            delivered: eng.delivered,
            opened: eng.opened,
            clicked: eng.clicked,
            reply_detected: eng.reply_detected,
            bounce_detected: eng.bounce_detected,
            unsubscribed: eng.unsubscribed,
          }
        : null,
    })
  }

  return rows
}
