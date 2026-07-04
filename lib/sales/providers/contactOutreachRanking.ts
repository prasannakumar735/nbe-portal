import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import { applyEngagementAdjustments, type ContactEngagementSignals } from '@/lib/sales/providers/contactOutreachSignals'
import type { ContactDiscoveryMethod, ContactPageKind } from '@/lib/sales/types/contactDiscovery.types'
import type { SalesContactType } from '@/lib/sales/types/contactSources'

export type OutreachRankingInput = {
  contact_type: SalesContactType
  page_kind: ContactPageKind | null
  discovery_method: ContactDiscoveryMethod | null
  link_label?: string | null
  email?: string | null
  contact_page?: string | null
  discovery_page_title?: string | null
  /** Optional — use computeOutreachPriorityWithEngagement when signals exist. */
  engagement?: ContactEngagementSignals
}

const TYPE_BASE: Record<SalesContactType, number> = {
  sales: 92,
  general: 78,
  support: 58,
  operations: 48,
  accounts: 28,
  hr: 18,
  unknown: 35,
}

const METHOD_ADJUST: Record<ContactDiscoveryMethod, number> = {
  mailto_labeled: 12,
  mailto: 8,
  body_text: 0,
  tel: 0,
}

const PAGE_KIND_ADJUST: Partial<Record<ContactPageKind, number>> = {
  branch: 10,
  contact: 8,
  quote: 6,
  location: 2,
  homepage: -4,
}

/** Dynamic outreach priority (never persisted). Does not use confidence_score. */
export function computeOutreachPriority(input: OutreachRankingInput): number {
  let score = TYPE_BASE[input.contact_type] ?? 30
  score += METHOD_ADJUST[input.discovery_method ?? 'body_text'] ?? 0
  if (input.page_kind) score += PAGE_KIND_ADJUST[input.page_kind] ?? 0

  if (input.page_kind === 'branch' && input.contact_type === 'sales') {
    score += 12
  }
  if (input.page_kind === 'contact' && input.discovery_method === 'mailto_labeled') {
    score += 8
  }
  if (input.page_kind === 'quote') {
    score += 4
  }

  const local = input.email?.split('@')[0] ?? ''
  if (/credit|finance|account|billing|invoice/i.test(local)) {
    score -= 35
  }

  return Math.min(100, Math.max(0, Math.round(score)))
}

/** Extension point for future engagement-aware ranking. */
export function computeOutreachPriorityWithEngagement(input: OutreachRankingInput): number {
  const base = computeOutreachPriority(input)
  if (!input.engagement) return base
  return applyEngagementAdjustments(base, input.engagement)
}

export function explainOutreachRecommendation(input: OutreachRankingInput): string {
  const label = (input.link_label ?? '').trim().toLowerCase()

  if (input.page_kind === 'branch' && input.contact_type === 'sales') {
    return 'Branch sales contact'
  }
  if (input.discovery_method === 'mailto_labeled' && /\bemail\s*us\b/.test(label)) {
    return 'Mailto from Email Us button'
  }
  if (input.discovery_method === 'mailto_labeled' && /\bcontact\s*us\b/.test(label)) {
    return 'Mailto from Contact Us button'
  }
  if (input.page_kind === 'contact') {
    return 'Found on Contact Us page'
  }
  if (input.contact_type === 'sales') {
    return 'Sales email detected'
  }
  if (input.contact_type === 'general') {
    return 'General enquiries contact'
  }
  if (input.contact_type === 'accounts') {
    return 'Accounts or finance contact (lower outreach value)'
  }
  return `${input.contact_type} contact`
}

function rankingInputFromResult(r: ContactResult): OutreachRankingInput {
  return {
    contact_type: r.contact_type,
    page_kind: r.page_kind,
    discovery_method: r.discovery_method,
    link_label: r.link_label,
    email: r.email,
    contact_page: r.contact_page,
    discovery_page_title: r.discovery_page_title,
  }
}

export function rankContactResults(results: ContactResult[]): ContactResult[] {
  return [...results].sort((a, b) => {
    const pa = computeOutreachPriority(rankingInputFromResult(a))
    const pb = computeOutreachPriority(rankingInputFromResult(b))
    if (pb !== pa) return pb - pa
    if (b.confidence_score !== a.confidence_score) return b.confidence_score - a.confidence_score
    return (a.email ?? '').localeCompare(b.email ?? '')
  })
}

export type RecommendedContactPick = {
  result: ContactResult
  reason: string
  priority: number
}

export function selectRecommendedContacts(
  results: ContactResult[],
  maxRecommended = 1,
): RecommendedContactPick[] {
  const emails = results.filter((r) => r.email)
  const ranked = rankContactResults(emails)
  return ranked.slice(0, maxRecommended).map((result) => {
    const input = rankingInputFromResult(result)
    return {
      result,
      priority: computeOutreachPriority(input),
      reason: explainOutreachRecommendation(input),
    }
  })
}

/**
 * Sort by outreach priority and mark recommended contacts (in-memory only until persisted by the job worker).
 */
export function applyOutreachRankingAndRecommendations(
  results: ContactResult[],
  maxRecommended = 1,
): ContactResult[] {
  const picks = selectRecommendedContacts(
    results.filter((r) => r.email),
    maxRecommended,
  )
  const reasonByEmail = new Map(
    picks
      .filter((p) => p.result.email)
      .map((p) => [p.result.email!.toLowerCase(), p.reason] as const),
  )
  const recommendedEmails = new Set(reasonByEmail.keys())

  const ranked = rankContactResults(results)
  return ranked.map((r) => {
    if (!r.email) {
      return { ...r, recommended_for_outreach: false, recommended_reason: null }
    }
    const key = r.email.toLowerCase()
    const recommended = recommendedEmails.has(key)
    return {
      ...r,
      recommended_for_outreach: recommended,
      recommended_reason: recommended ? (reasonByEmail.get(key) ?? null) : null,
    }
  })
}

export type OutreachContactPick = {
  id: string
  business_id: string
  email: string | null
  contact_type: SalesContactType
  confidence_score: number
  recommended_for_outreach: boolean
  page_kind: ContactPageKind | null
  discovery_method: ContactDiscoveryMethod | null
  link_label?: string | null
  contact_page?: string | null
  recommended_reason?: string | null
}

export function pickRecommendedOutreachContactIds(contacts: OutreachContactPick[]): string[] {
  const byBusiness = new Map<string, OutreachContactPick[]>()
  for (const c of contacts) {
    if (!c.email?.trim()) continue
    const list = byBusiness.get(c.business_id) ?? []
    list.push(c)
    byBusiness.set(c.business_id, list)
  }

  const recommended = new Set<string>()
  for (const list of byBusiness.values()) {
    const flagged = list.filter((c) => c.recommended_for_outreach)
    if (flagged.length > 0) {
      for (const c of flagged) recommended.add(c.id)
      continue
    }

    const sorted = [...list].sort((a, b) => {
      const pa = computeOutreachPriority({
        contact_type: a.contact_type,
        page_kind: a.page_kind,
        discovery_method: a.discovery_method,
        email: a.email,
        link_label: a.link_label,
      })
      const pb = computeOutreachPriority({
        contact_type: b.contact_type,
        page_kind: b.page_kind,
        discovery_method: b.discovery_method,
        email: b.email,
        link_label: b.link_label,
      })
      return pb - pa
    })
    if (sorted[0]) recommended.add(sorted[0].id)
  }

  return [...recommended]
}

export function outreachPriorityForContact(contact: OutreachContactPick): number {
  return computeOutreachPriority({
    contact_type: contact.contact_type,
    page_kind: contact.page_kind,
    discovery_method: contact.discovery_method,
    email: contact.email,
    link_label: contact.link_label,
    contact_page: contact.contact_page,
  })
}
