import type { SupabaseClient } from '@supabase/supabase-js'
import { getContactDiscoveryProvider } from '@/lib/sales/providers/contactProviders'
import { candidatePageUrls } from '@/lib/sales/providers/websiteFetch'
import type { ContactDiscoveryJobPayload } from '@/lib/sales/jobs/job.types'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import {
  insertSalesContactsSkipDuplicates,
  setPrimarySalesContact,
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
    const results = await provider.scanWebsite(website)
    const normalizedUrl = website.startsWith('http') ? website : `https://${website}`
    const pages_scanned = candidatePageUrls(normalizedUrl).length
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
    }))

    const { inserted, skipped } = await insertSalesContactsSkipDuplicates(supabase, inserts)

    const primaryCandidate = inserted
      .filter((c) => c.email)
      .sort((a, b) => b.confidence_score - a.confidence_score)[0]
    if (primaryCandidate) {
      await setPrimarySalesContact(supabase, business.id, primaryCandidate.id)
    }

    await completeSalesContactScanLog(supabase, scanLog.id, {
      emails_found,
      scanned_pages: pages_scanned,
    })

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
