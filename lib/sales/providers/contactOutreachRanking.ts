import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import { applyEngagementAdjustments, type ContactEngagementSignals } from '@/lib/sales/providers/contactOutreachSignals'
import type { ContactDiscoveryMethod, ContactPageKind } from '@/lib/sales/types/contactDiscovery.types'
import type { SalesContactType } from '@/lib/sales/types/contactSources'

export type OutreachRankingInput = {
  contact_type: SalesContactType
  confidence_score: number
  page_kind: ContactPageKind | null
  discovery_method: ContactDiscoveryMethod | null
  link_label?: string | null
  email?: string | null
  contact_page?: string | null
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
  sales: 6,
  locations_hub: 2,
  homepage: -4,
}

export function computeOutreachPriority(input: OutreachRankingInput): number {
  let score = TYPE_BASE[input.contact_type] ?? 30
  score += METHOD_ADJUST[input.discovery_method ?? 'body_text'] ?? 0
  if (input.page_kind) score += PAGE_KIND_ADJUST[input.page_kind] ?? 0

  if (input.page_kind === 'branch' && input.contact_type === 'sales') {
    score += 12
  }
  if (input.discovery_method === 'mailto_labeled' && input.contact_type === 'general') {
    score += 6
  }

  const local = input.email?.split('@')[0] ?? ''
  if (/credit|finance|account|billing|invoice/i.test(local)) {
    score -= 35
  }

  score += Math.round((input.confidence_score - 50) * 0.08)

  return applyEngagementAdjustments(Math.min(100, Math.max(0, Math.round(score))), input.engagement ?? {})
}

export function explainOutreachRecommendation(input: OutreachRankingInput): string {
  const parts: string[] = []
  if (input.page_kind === 'branch' && input.contact_type === 'sales') {
    parts.push('Branch sales email from a location page')
  } else if (input.contact_type === 'sales') {
    parts.push('Sales inbox')
  } else if (input.discovery_method === 'mailto_labeled') {
    parts.push(`Customer-facing mailto link (${input.link_label?.trim() || 'labeled CTA'})`)
  } else if (input.contact_type === 'general' && input.page_kind === 'contact') {
    parts.push('General enquiries on contact page')
  } else if (input.contact_type === 'general') {
    parts.push('General enquiries address')
  } else if (input.contact_type === 'accounts') {
    parts.push('Finance/accounts inbox (lower outreach value)')
  } else {
    parts.push(`${input.contact_type} contact`)
  }

  if (input.contact_page) {
    parts.push(`found on ${input.contact_page}`)
  }
  return parts.join(' · ')
}

function rankingInputFromResult(r: ContactResult): OutreachRankingInput {
  return {
    contact_type: r.contact_type,
    confidence_score: r.confidence_score,
    page_kind: r.page_kind,
    discovery_method: r.discovery_method,
    link_label: r.link_label,
    email: r.email,
    contact_page: r.contact_page,
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
  maxPerBusiness = 1,
): RecommendedContactPick[] {
  const emails = results.filter((r) => r.email)
  const ranked = rankContactResults(emails)
  return ranked.slice(0, maxPerBusiness).map((result) => {
    const input = rankingInputFromResult(result)
    return {
      result,
      priority: computeOutreachPriority(input),
      reason: explainOutreachRecommendation({ ...input, contact_page: result.contact_page }),
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
        confidence_score: a.confidence_score,
        page_kind: a.page_kind,
        discovery_method: a.discovery_method,
        email: a.email,
      })
      const pb = computeOutreachPriority({
        contact_type: b.contact_type,
        confidence_score: b.confidence_score,
        page_kind: b.page_kind,
        discovery_method: b.discovery_method,
        email: b.email,
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
    confidence_score: contact.confidence_score,
    page_kind: contact.page_kind,
    discovery_method: contact.discovery_method,
    email: contact.email,
  })
}
