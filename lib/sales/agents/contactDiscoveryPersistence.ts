import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import type { SalesContact, SalesContactInsert } from '@/lib/sales/types/contact.types'

export function buildDiscoveryUpsertRows(
  businessId: string,
  results: ContactResult[],
  discoveredAt: string,
): SalesContactInsert[] {
  return results
    .filter((r) => r.email?.trim())
    .map((r) => ({
      business_id: businessId,
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
      discovered_at: discoveredAt,
    }))
}

export type DiscoveryRecommendation = {
  contactId: string
  reason: string
  email: string
}

export function resolveDiscoveryRecommendations(
  scanResults: ContactResult[],
  persisted: SalesContact[],
): DiscoveryRecommendation[] {
  const idByEmail = new Map(
    persisted.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id] as const),
  )

  const recommended = scanResults.filter((r) => r.email && r.recommended_for_outreach)
  const ordered =
    recommended.length > 0
      ? recommended
      : scanResults.filter((r) => r.email).slice(0, 1)

  const out: DiscoveryRecommendation[] = []
  for (const r of ordered) {
    const email = r.email!.toLowerCase()
    const contactId = idByEmail.get(email)
    if (!contactId) continue
    out.push({
      contactId,
      email,
      reason: r.recommended_reason?.trim() || 'Recommended outreach contact',
    })
  }

  const seen = new Set<string>()
  return out.filter((rec) => {
    if (seen.has(rec.contactId)) return false
    seen.add(rec.contactId)
    return true
  })
}

export function countPersistableEmails(results: ContactResult[]): number {
  return results.filter((r) => r.email?.trim()).length
}
