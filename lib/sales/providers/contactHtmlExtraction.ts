import * as cheerio from 'cheerio'
import {
  classifyContactFromEmail,
  isMailtoLabeled,
  mailtoLinkLabelBoost,
  normalizeEmail,
} from '@/lib/sales/providers/contactClassification'
import { readPageTitle } from '@/lib/sales/providers/contactPageDiscovery'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import { EMAIL_PATTERN, PHONE_PATTERN } from '@/lib/sales/providers/websiteFetch'
import type { ContactDiscoveryMethod, ContactPageKind } from '@/lib/sales/types/contactDiscovery.types'

function methodRank(method: ContactDiscoveryMethod | null): number {
  switch (method) {
    case 'mailto_labeled':
      return 3
    case 'mailto':
      return 2
    case 'body_text':
      return 1
    default:
      return 0
  }
}

function isBetterResult(candidate: ContactResult, existing: ContactResult): boolean {
  if (candidate.confidence_score !== existing.confidence_score) {
    return candidate.confidence_score > existing.confidence_score
  }
  return methodRank(candidate.discovery_method) > methodRank(existing.discovery_method)
}

/**
 * Extract contacts from a fetched HTML page.
 * Confidence reflects extraction quality only (not outreach priority).
 */
export function extractContactsFromHtml(
  html: string,
  pageUrl: string,
  pageKind: ContactPageKind,
): ContactResult[] {
  const $ = cheerio.load(html)
  const found: ContactResult[] = []
  const seenEmails = new Set<string>()
  const discovery_page_title = readPageTitle(html)

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!/^mailto:/i.test(href)) return
    const raw = href.replace(/^mailto:/i, '').split('?')[0]
    const email = normalizeEmail(raw)
    if (!email || seenEmails.has(email)) return
    seenEmails.add(email)
    const linkLabel = ($(el).text() ?? '').trim()
    const labelBoost = mailtoLinkLabelBoost(linkLabel)
    const discovery_method: ContactDiscoveryMethod = isMailtoLabeled(linkLabel)
      ? 'mailto_labeled'
      : 'mailto'
    found.push({
      email,
      phone: null,
      contact_page: pageUrl,
      contact_type: classifyContactFromEmail(email),
      confidence_score: Math.min(98, 76 + labelBoost),
      source: 'website_scan',
      discovery_page_title,
      discovery_method,
      page_kind: pageKind,
      link_label: linkLabel || null,
    })
  })

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const phone = href.replace(/^tel:/i, '').trim()
    if (!phone) return
    found.push({
      email: null,
      phone,
      contact_page: pageUrl,
      contact_type: 'unknown',
      confidence_score: 62,
      source: 'website_scan',
      discovery_page_title,
      discovery_method: 'tel',
      page_kind: pageKind,
    })
  })

  const footerText = $('footer').text()
  const bodyText = `${footerText}\n${$('body').text()}`.slice(0, 50_000)
  const emails = bodyText.match(EMAIL_PATTERN) ?? []
  for (const match of emails) {
    const email = normalizeEmail(match)
    if (!email || seenEmails.has(email)) continue
    seenEmails.add(email)
    found.push({
      email,
      phone: null,
      contact_page: pageUrl,
      contact_type: classifyContactFromEmail(email),
      confidence_score: Math.min(78, 52),
      source: 'website_scan',
      discovery_page_title,
      discovery_method: 'body_text',
      page_kind: pageKind,
    })
  }

  const phones = bodyText.match(PHONE_PATTERN) ?? []
  for (const phone of phones.slice(0, 3)) {
    found.push({
      email: null,
      phone: phone.trim(),
      contact_page: pageUrl,
      contact_type: 'unknown',
      confidence_score: 58,
      source: 'website_scan',
      discovery_page_title,
      discovery_method: 'tel',
      page_kind: pageKind,
    })
  }

  return found
}

export function dedupeContactResults(results: ContactResult[]): ContactResult[] {
  const byKey = new Map<string, ContactResult>()
  for (const r of results) {
    const key = r.email ? `e:${r.email}` : r.phone ? `p:${r.phone}` : `u:${r.contact_page}`
    const existing = byKey.get(key)
    if (!existing || isBetterResult(r, existing)) {
      byKey.set(key, r)
    }
  }
  return [...byKey.values()]
}
