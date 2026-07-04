import * as cheerio from 'cheerio'
import {
  classifyContactFromEmail,
  isMailtoLabeled,
  mailtoLinkLabelBoost,
  normalizeEmail,
} from '@/lib/sales/providers/contactClassification'
import { crawlContactPagesBounded } from '@/lib/sales/providers/contactCrawlPlanner'
import { normalizePageUrl, pageIntentBoost, readPageTitle } from '@/lib/sales/providers/contactPageDiscovery'
import type { ContactDiscoveryProvider } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import { rankContactResults } from '@/lib/sales/providers/contactOutreachRanking'
import {
  fetchHtmlPage,
  normalizeWebsiteUrl,
  EMAIL_PATTERN,
  PHONE_PATTERN,
} from '@/lib/sales/providers/websiteFetch'
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

function extractFromHtml(
  html: string,
  pageUrl: string,
  pageKind: ContactPageKind,
): ContactResult[] {
  const $ = cheerio.load(html)
  const found: ContactResult[] = []
  const seenEmails = new Set<string>()
  const page = new URL(pageUrl)
  const boost = pageIntentBoost(page.pathname)
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
      confidence_score: Math.min(98, 78 + boost + labelBoost),
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
      confidence_score: Math.min(85, 60 + boost),
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
      confidence_score: Math.min(80, 52 + boost),
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
      confidence_score: Math.min(75, 50 + boost),
      source: 'website_scan',
      discovery_page_title,
      discovery_method: 'tel',
      page_kind: pageKind,
    })
  }

  return found
}

function dedupeResults(results: ContactResult[]): ContactResult[] {
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

export const basicWebsiteContactProvider: ContactDiscoveryProvider = {
  providerId: 'basic_website',

  async scanWebsite(url: string) {
    const normalized = normalizeWebsiteUrl(url)
    const base = new URL(normalized)
    const home = normalizePageUrl(new URL('/', base).toString(), base)

    const htmlCache = new Map<string, string | null>()
    const getHtml = async (pageUrl: string): Promise<string | null> => {
      if (!htmlCache.has(pageUrl)) {
        htmlCache.set(pageUrl, await fetchHtmlPage(pageUrl))
      }
      return htmlCache.get(pageUrl) ?? null
    }

    const homeHtml = await getHtml(home)
    const aggregated: ContactResult[] = []
    const { visits, pages_scanned } = await crawlContactPagesBounded(
      normalized,
      getHtml,
      homeHtml,
    )

    for (const { page, html } of visits) {
      if (!html) continue
      aggregated.push(...extractFromHtml(html, page.url, page.page_kind))
    }

    return {
      results: rankContactResults(dedupeResults(aggregated)),
      pages_scanned,
    }
  },
}
