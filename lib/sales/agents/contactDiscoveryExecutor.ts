import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildDiscoveryUpsertRows,
  countPersistableEmails,
  resolveDiscoveryRecommendations,
} from '@/lib/sales/agents/contactDiscoveryPersistence'
import { getContactDiscoveryProvider } from '@/lib/sales/providers/contactProviders'
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
  contacts_discovered: number
  contacts_inserted: number
  contacts_updated: number
  contacts_recommended: number
  /** @deprecated Use contacts_updated; kept for API compatibility. */
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
      contacts_discovered: 0,
      contacts_inserted: 0,
      contacts_updated: 0,
      contacts_recommended: 0,
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
    const contacts_discovered = countPersistableEmails(results)
    const discoveredAt = new Date().toISOString()

    const upsertRows = buildDiscoveryUpsertRows(business.id, results, discoveredAt)
    const { inserted, updated } = await upsertSalesContactsFromDiscovery(
      supabase,
      business.id,
      upsertRows,
    )
    const allTouched = [...inserted, ...updated]

    const recommendations = resolveDiscoveryRecommendations(results, allTouched)
    if (recommendations.length > 0) {
      await setRecommendedSalesContacts(
        supabase,
        business.id,
        recommendations.map(({ contactId, reason }) => ({ contactId, reason })),
      )
      await setPrimarySalesContact(supabase, business.id, recommendations[0].contactId)
    }

    await completeSalesContactScanLog(supabase, scanLog.id, {
      emails_found: contacts_discovered,
      scanned_pages: pages_scanned,
    })

    const notPersisted = Math.max(0, upsertRows.length - allTouched.length)

    return {
      business_id: business.id,
      website,
      contacts_discovered,
      contacts_inserted: inserted.length,
      contacts_updated: updated.length,
      contacts_recommended: recommendations.length,
      contacts_skipped: notPersisted,
      pages_scanned,
      scan_log_id: scanLog.id,
    }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)
    await failSalesContactScanLog(supabase, scanLog.id, { error_message })
    throw error
  }
}
