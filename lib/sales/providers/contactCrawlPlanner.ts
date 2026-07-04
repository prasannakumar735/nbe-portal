import * as cheerio from 'cheerio'
import {
  isSameSite,
  linkLooksLikeContactPage,
  linkLooksLikeLocationsHub,
  looksLikeBranchPage,
  normalizePageUrl,
  shouldExcludeCrawlPath,
} from '@/lib/sales/providers/contactPageDiscovery'
import { assertPublicWebsiteUrl } from '@/lib/sales/providers/websiteFetch'
import type { ContactPageKind } from '@/lib/sales/types/contactDiscovery.types'

export type PlannedCrawlPage = {
  url: string
  page_kind: ContactPageKind
}

const HUB_LABEL_RE =
  /\b(contact\s*us|email\s*us|contact|enquir|inquir|get\s*(a\s*)?quote|request\s*(a\s*)?quote|sales|locations?|branches|find\s*us|offices|service)\b/i

export function classifyPageKind(pathname: string, linkLabel?: string): ContactPageKind {
  const p = pathname.toLowerCase()
  const label = (linkLabel ?? '').toLowerCase()
  if (p === '/' || p === '') return 'homepage'
  if (/(location|branch|store|depot|showroom|office)/.test(p) && p.split('/').filter(Boolean).length >= 2) {
    return 'branch'
  }
  if (/(location|branch|find-us|offices|stores|depots)/.test(p) || /\blocations?\b/.test(label)) {
    return 'locations_hub'
  }
  if (/(contact|contact-us)/.test(p) || /\bcontact\b/.test(label)) return 'contact'
  if (/(quote|get-quote|request-quote)/.test(p) || /\bquote\b/.test(label)) return 'quote'
  if (/(^|\/)sales(\/|$)/.test(p) || /\bsales\b/.test(label)) return 'sales'
  if (/(service|services)/.test(p) || /\bservice\b/.test(label)) return 'service'
  if (linkLooksLikeContactPage(linkLabel ?? '', pathname)) return 'other'
  return 'other'
}

function collectAnchorHrefs(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  base: URL,
): Array<{ url: string; label: string; pathname: string }> {
  const out: Array<{ url: string; label: string; pathname: string }> = []
  const seen = new Set<string>()
  const selectors = [
    'nav a[href]',
    'header a[href]',
    '[role="navigation"] a[href]',
    'main a[href]',
    'footer a[href]',
    'body a[href]',
  ]
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href')?.trim()
      if (!href) return
      const lower = href.toLowerCase()
      if (
        lower.startsWith('#') ||
        lower.startsWith('javascript:') ||
        lower.startsWith('mailto:') ||
        lower.startsWith('tel:')
      ) {
        return
      }
      try {
        const link = new URL(href, pageUrl)
        if (!isSameSite(base, link)) return
        if (shouldExcludeCrawlPath(link.pathname, href)) return
        assertPublicWebsiteUrl(link.toString())
        const normalized = normalizePageUrl(link.toString(), base)
        if (seen.has(normalized)) return
        seen.add(normalized)
        out.push({
          url: normalized,
          label: ($(el).text() ?? '').trim().replace(/\s+/g, ' '),
          pathname: link.pathname,
        })
      } catch {
        /* skip */
      }
    })
  }
  return out
}

export function discoverHubPagesFromHtml(
  html: string,
  pageUrl: string,
  baseUrl: string,
): PlannedCrawlPage[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const anchors = collectAnchorHrefs($, pageUrl, base)

  const scored = new Map<string, PlannedCrawlPage & { score: number }>()
  for (const a of anchors) {
    if (!HUB_LABEL_RE.test(a.label) && !linkLooksLikeContactPage(a.label, a.pathname)) continue
    if (linkLooksLikeLocationsHub(a.label, a.pathname) || classifyPageKind(a.pathname, a.label) !== 'other') {
      const page_kind = classifyPageKind(a.pathname, a.label)
      if (page_kind === 'branch') continue
      const score =
        (HUB_LABEL_RE.test(a.label) ? 10 : 0) +
        (page_kind === 'contact' ? 8 : 0) +
        (page_kind === 'locations_hub' ? 7 : 0) +
        (page_kind === 'quote' ? 6 : 0)
      const existing = scored.get(a.url)
      if (!existing || score > existing.score) {
        scored.set(a.url, { url: a.url, page_kind, score })
      }
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ url, page_kind }) => ({ url, page_kind }))
}

export function discoverBranchPagesFromHtml(
  html: string,
  pageUrl: string,
  baseUrl: string,
): PlannedCrawlPage[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const anchors = collectAnchorHrefs($, pageUrl, base)
  const out: PlannedCrawlPage[] = []
  const seen = new Set<string>()

  for (const a of anchors) {
    if (!looksLikeBranchPage(a.label, a.pathname)) continue
    if (seen.has(a.url)) continue
    seen.add(a.url)
    out.push({ url: a.url, page_kind: 'branch' })
  }

  return out
}

export function fallbackSeedPages(baseUrl: string): PlannedCrawlPage[] {
  const base = new URL(baseUrl)
  const paths: Array<{ path: string; page_kind: ContactPageKind }> = [
    { path: '/contact', page_kind: 'contact' },
    { path: '/contact-us', page_kind: 'contact' },
    { path: '/locations', page_kind: 'locations_hub' },
    { path: '/sales', page_kind: 'sales' },
  ]
  return paths.map(({ path, page_kind }) => ({
    url: normalizePageUrl(new URL(path, base).toString(), base),
    page_kind,
  }))
}

export function buildInitialCrawlPlan(baseUrl: string, homeHtml: string | null): PlannedCrawlPage[] {
  const base = new URL(baseUrl)
  const home = normalizePageUrl(new URL('/', base).toString(), base)
  const plan: PlannedCrawlPage[] = [{ url: home, page_kind: 'homepage' }]
  const seen = new Set<string>([home])

  if (homeHtml) {
    for (const page of discoverHubPagesFromHtml(homeHtml, home, baseUrl)) {
      if (seen.has(page.url)) continue
      seen.add(page.url)
      plan.push(page)
    }
  }

  if (plan.length === 1) {
    for (const page of fallbackSeedPages(baseUrl)) {
      if (seen.has(page.url)) continue
      seen.add(page.url)
      plan.push(page)
    }
  }

  return plan
}
