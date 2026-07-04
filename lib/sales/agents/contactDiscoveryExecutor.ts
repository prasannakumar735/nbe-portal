import type { SupabaseClient } from '@supabase/supabase-js'
import { getContactDiscoveryProvider } from '@/lib/sales/providers/contactProviders'
import { selectRecommendedContacts } from '@/lib/sales/providers/contactOutreachRanking'
import type { ContactDiscoveryJobPayload } from '@/lib/sales/jobs/job.types'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import {
  setPrimarySalesContact,
  setRecommendedSalesContacts,
  upsertSalesContactsFromDiscovery,
} from '@/lib/sales/repositories/salesContactRepository'
import {
  completeSalesContactScanLog,
  createSalesContactScanLog,
  failSalesContactScanLog,
} from '@/lib/sales/repositories/salesContactScanRepository'

export type ContactDiscoveryJobResult = {
  business_id: string
  website: string | null
  contacts_inserted: number
  contacts_skipped: number
  pages_scanned: number
  scan_log_id?: string
  skipped_reason?: string
}

/**
 * Worker for contact_discovery jobs — one business per job.
 */
export async function executeContactDiscoveryJob(
  supabase: SupabaseClient,
  payload: ContactDiscoveryJobPayload,
): Promise<ContactDiscoveryJobResult> {
  const business = await getSalesBusinessById(supabase, payload.business_id)
  if (!business) {
    throw new Error('Business not found.')
  }

  const website = business.website?.trim() || null
  if (!website) {
    return {
      business_id: business.id,
      website: null,
      contacts_inserted: 0,
      contacts_skipped: 0,
      pages_scanned: 0,
      skipped_reason: 'no_website',
    }
  }

  const scanLog = await createSalesContactScanLog(supabase, {
    business_id: business.id,
    website,
    status: 'running',
  })

  try {
    const provider = getContactDiscoveryProvider()
    const { results, pages_scanned } = await provider.scanWebsite(website)
    const emails_found = results.filter((r) => r.email).length

    const inserts = results.map((r) => ({
      business_id: business.id,
      email: r.email,
      phone: r.phone,
      contact_page: r.contact_page,
      contact_type: r.contact_type,
      confidence_score: r.confidence_score,
      is_primary: false,
      source: r.source,
      discovery_page_title: r.discovery_page_title,
      discovery_method: r.discovery_method,
      page_kind: r.page_kind,
      recommended_for_outreach: false,
      recommended_reason: null,
    }))

    const { inserted, updated } = await upsertSalesContactsFromDiscovery(
      supabase,
      business.id,
      inserts,
    )
    const allTouched = [...inserted, ...updated]

    const recommended = selectRecommendedContacts(results, 1)
    const emailToId = new Map(
      allTouched.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id] as const),
    )

    const recommendations = recommended
      .map((pick) => {
        const email = pick.result.email?.toLowerCase()
        if (!email) return null
        const contactId = emailToId.get(email)
        if (!contactId) return null
        return { contactId, reason: pick.reason }
      })
      .filter((r): r is { contactId: string; reason: string } => r != null)

    if (recommendations.length > 0) {
      await setRecommendedSalesContacts(supabase, business.id, recommendations)
      await setPrimarySalesContact(supabase, business.id, recommendations[0].contactId)
    }

    await completeSalesContactScanLog(supabase, scanLog.id, {
      emails_found,
      scanned_pages: pages_scanned,
    })

    const skipped = Math.max(0, inserts.filter((r) => r.email).length - allTouched.length)

    return {
      business_id: business.id,
      website,
      contacts_inserted: inserted.length,
      contacts_skipped: skipped,
      pages_scanned,
      scan_log_id: scanLog.id,
    }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)
    await failSalesContactScanLog(supabase, scanLog.id, { error_message })
    throw error
  }
}
