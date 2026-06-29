import * as cheerio from 'cheerio'
import {
  classifyContactFromEmail,
  normalizeEmail,
} from '@/lib/sales/providers/contactClassification'
import type { ContactDiscoveryProvider } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import {
  assertPublicWebsiteUrl,
  candidatePageUrls,
  EMAIL_PATTERN,
  fetchHtmlPage,
  normalizeWebsiteUrl,
  PHONE_PATTERN,
} from '@/lib/sales/providers/websiteFetch'

function pageConfidenceBoost(pathname: string): number {
  const p = pathname.toLowerCase()
  if (p.includes('contact')) return 15
  if (p.includes('about')) return 8
  return 0
}

function extractFromHtml(html: string, pageUrl: string): ContactResult[] {
  const $ = cheerio.load(html)
  const found: ContactResult[] = []
  const seenEmails = new Set<string>()
  const page = new URL(pageUrl)
  const boost = pageConfidenceBoost(page.pathname)

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const raw = href.replace(/^mailto:/i, '').split('?')[0]
    const email = normalizeEmail(raw)
    if (!email || seenEmails.has(email)) return
    seenEmails.add(email)
    found.push({
      email,
      phone: null,
      contact_page: pageUrl,
      contact_type: classifyContactFromEmail(email),
      confidence_score: Math.min(95, 72 + boost),
      source: 'website_scan',
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
      confidence_score: Math.min(85, 60 + boost),
      source: 'website_scan',
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
      confidence_score: Math.min(80, 55 + boost),
      source: 'website_scan',
    })
  }

  const phones = bodyText.match(PHONE_PATTERN) ?? []
  for (const phone of phones.slice(0, 3)) {
    found.push({
      email: null,
      phone: phone.trim(),
      contact_page: pageUrl,
      contact_type: 'unknown',
      confidence_score: Math.min(75, 50 + boost),
      source: 'website_scan',
    })
  }

  $('footer a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim()
    if (!href) return
    try {
      const link = new URL(href, pageUrl)
      assertPublicWebsiteUrl(link.toString())
      const label = ($(el).text() ?? '').toLowerCase()
      if (label.includes('contact') || /\/contact/i.test(link.pathname)) {
        found.push({
          email: null,
          phone: null,
          contact_page: link.toString(),
          contact_type: 'general',
          confidence_score: 45,
          source: 'website_scan',
        })
      }
    } catch {
      /* ignore bad footer links */
    }
  })

  return found
}

function dedupeResults(results: ContactResult[]): ContactResult[] {
  const byKey = new Map<string, ContactResult>()
  for (const r of results) {
    const key = r.email ? `e:${r.email}` : r.phone ? `p:${r.phone}` : `u:${r.contact_page}`
    const existing = byKey.get(key)
    if (!existing || r.confidence_score > existing.confidence_score) {
      byKey.set(key, r)
    }
  }
  return [...byKey.values()]
}

export const basicWebsiteContactProvider: ContactDiscoveryProvider = {
  providerId: 'basic_website',

  async scanWebsite(url: string): Promise<ContactResult[]> {
    const normalized = normalizeWebsiteUrl(url)
    const pages = candidatePageUrls(normalized)
    const aggregated: ContactResult[] = []

    for (const pageUrl of pages) {
      const html = await fetchHtmlPage(pageUrl)
      if (!html) continue
      aggregated.push(...extractFromHtml(html, pageUrl))
    }

    return dedupeResults(aggregated)
  },
}
