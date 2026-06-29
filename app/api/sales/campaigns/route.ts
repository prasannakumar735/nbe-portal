import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { insertSalesCampaignContacts } from '@/lib/sales/repositories/salesCampaignContactsRepository'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import { createSalesCampaign } from '@/lib/sales/repositories/salesCampaignRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import type { CreateSalesCampaignResult } from '@/lib/sales/types/campaign.types'
import { createSalesCampaignBodySchema } from '@/lib/sales/validators/campaign.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 65_536)
    const body = await request.json()
    const parsed = createSalesCampaignBodySchema.parse(body)

    const uniqueContactIds = [...new Set(parsed.selectedEmailIds)]
    const uniqueBusinessIds = [...new Set(parsed.selectedBusinessIds)]

    const contacts = await listSalesContactsByIds(auth.supabase, uniqueContactIds)
    if (contacts.length !== uniqueContactIds.length) {
      return fail('One or more selected contacts were not found.', 400)
    }

    const missingEmail = contacts.find((c) => !c.email?.trim())
    if (missingEmail) {
      return fail('All selected contacts must have an email address.', 400)
    }

    const businessIdsFromContacts = new Set(contacts.map((c) => c.business_id))
    const businessIdsFromRequest = new Set(uniqueBusinessIds)

    if (!setsEqual(businessIdsFromContacts, businessIdsFromRequest)) {
      return fail('Selected businesses must match the businesses for selected emails.', 400)
    }

    const total_businesses = businessIdsFromContacts.size
    const total_contacts = contacts.length

    const campaignType = await getSalesCampaignTypeById(auth.supabase, parsed.campaignTypeId)
    if (!campaignType || !campaignType.is_active) {
      return fail('Invalid or inactive campaign type.', 400)
    }
    const offerType = await getSalesOfferTypeById(auth.supabase, parsed.offerTypeId)
    if (!offerType || !offerType.is_active) {
      return fail('Invalid or inactive offer type.', 400)
    }

    const campaign = await createSalesCampaign(auth.supabase, {
      name: parsed.name,
      campaign_type_id: parsed.campaignTypeId,
      offer_type_id: parsed.offerTypeId,
      status: 'draft',
      total_businesses,
      total_contacts,
      created_by: auth.userId,
    })

    await insertSalesCampaignContacts(
      auth.supabase,
      contacts.map((c) => ({
        campaign_id: campaign.id,
        contact_id: c.id,
        business_id: c.business_id,
        selected: true,
      })),
    )

    const result: CreateSalesCampaignResult = { campaign }
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to create campaign', 500)
  }
}
