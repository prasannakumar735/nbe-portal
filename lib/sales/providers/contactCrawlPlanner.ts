import * as cheerio from 'cheerio'
import {
  isSameSite,
  linkLooksLikeContactPage,
  linkLooksLikeLocationsHub,
  looksLikeBranchPage,
  normalizePageUrl,
  shouldExcludeCrawlPath,
} from '@/lib/sales/providers/contactPageDiscovery'
import {
  assertPublicWebsiteUrl,
  MAX_CONTACT_BRANCH_PAGES,
  MAX_CONTACT_HUB_PAGES,
  MAX_CONTACT_SCAN_PAGES,
} from '@/lib/sales/providers/websiteFetch'
import type { ContactPageKind } from '@/lib/sales/types/contactDiscovery.types'

export type PlannedCrawlPage = {
  url: string
  page_kind: ContactPageKind
}

export type ContactCrawlPageVisit = {
  page: PlannedCrawlPage
  html: string | null
}

export type ContactCrawlFetchHtml = (url: string) => Promise<string | null>

const HUB_LABEL_RE =
  /\b(contact\s*us|email\s*us|contact|enquir|inquir|get\s*(a\s*)?quote|request\s*(a\s*)?quote|sales|locations?|branches|find\s*us|offices|service)\b/i

const NAV_SELECTORS = ['nav a[href]', 'header a[href]', '[role="navigation"] a[href]']
const BODY_SELECTORS = ['main a[href]', 'footer a[href]', 'body a[href]']

export function classifyPageKind(pathname: string, linkLabel?: string): ContactPageKind {
  const p = pathname.toLowerCase()
  const label = (linkLabel ?? '').toLowerCase()
  if (p === '/' || p === '') return 'homepage'
  if (
    /(location|branch|store|depot|showroom|office)/.test(p) &&
    p.split('/').filter(Boolean).length >= 2
  ) {
    return 'branch'
  }
  if (/(location|branch|find-us|offices|stores|depots)/.test(p) || /\blocations?\b/.test(label)) {
    return 'location'
  }
  if (/(contact|contact-us)/.test(p) || /\bcontact\b/.test(label)) return 'contact'
  if (/(quote|get-quote|request-quote)/.test(p) || /\bquote\b/.test(label)) return 'quote'
  if (linkLooksLikeContactPage(linkLabel ?? '', pathname)) return 'other'
  return 'other'
}

type AnchorRef = { url: string; label: string; pathname: string; fromNav: boolean }

function pushAnchor(
  out: AnchorRef[],
  seen: Set<string>,
  entry: AnchorRef,
): void {
  if (seen.has(entry.url)) return
  seen.add(entry.url)
  out.push(entry)
}

function collectAnchorsFromSelectors(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  base: URL,
  selectors: string[],
  fromNav: boolean,
  seen: Set<string>,
  out: AnchorRef[],
): void {
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
        pushAnchor(out, seen, {
          url: normalized,
          label: ($(el).text() ?? '').trim().replace(/\s+/g, ' '),
          pathname: link.pathname,
          fromNav,
        })
      } catch {
        /* skip invalid links */
      }
    })
  }
}

/** Navigation regions first, then broader page links (deduped). */
export function collectRelevantAnchors(
  html: string,
  pageUrl: string,
  baseUrl: string,
): AnchorRef[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const out: AnchorRef[] = []
  collectAnchorsFromSelectors($, pageUrl, base, NAV_SELECTORS, true, seen, out)
  collectAnchorsFromSelectors($, pageUrl, base, BODY_SELECTORS, false, seen, out)
  return out
}

export function discoverHubPagesFromHtml(
  html: string,
  pageUrl: string,
  baseUrl: string,
): PlannedCrawlPage[] {
  const anchors = collectRelevantAnchors(html, pageUrl, baseUrl)
  const scored = new Map<string, PlannedCrawlPage & { score: number }>()

  for (const a of anchors) {
    if (!HUB_LABEL_RE.test(a.label) && !linkLooksLikeContactPage(a.label, a.pathname)) continue
    if (
      !linkLooksLikeLocationsHub(a.label, a.pathname) &&
      classifyPageKind(a.pathname, a.label) === 'other'
    ) {
      continue
    }
    const page_kind = classifyPageKind(a.pathname, a.label)
    if (page_kind === 'branch') continue
    const score =
      (a.fromNav ? 14 : 0) +
      (HUB_LABEL_RE.test(a.label) ? 10 : 0) +
      (page_kind === 'contact' ? 8 : 0) +
      (page_kind === 'location' ? 7 : 0) +
      (page_kind === 'quote' ? 6 : 0)
    const existing = scored.get(a.url)
    if (!existing || score > existing.score) {
      scored.set(a.url, { url: a.url, page_kind, score })
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
  const anchors = collectRelevantAnchors(html, pageUrl, baseUrl)
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
    { path: '/locations', page_kind: 'location' },
  ]
  return paths.map(({ path, page_kind }) => ({
    url: normalizePageUrl(new URL(path, base).toString(), base),
    page_kind,
  }))
}

/** Homepage plus up to MAX_CONTACT_HUB_PAGES hub URLs. */
export function capHubPagesInPlan(plan: PlannedCrawlPage[]): PlannedCrawlPage[] {
  const homepage = plan.filter((p) => p.page_kind === 'homepage')
  const hubs = plan.filter((p) => p.page_kind !== 'homepage').slice(0, MAX_CONTACT_HUB_PAGES)
  const seen = new Set<string>()
  const merged: PlannedCrawlPage[] = []
  for (const page of [...homepage, ...hubs]) {
    if (seen.has(page.url)) continue
    seen.add(page.url)
    merged.push(page)
  }
  return merged
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

  return capHubPagesInPlan(plan)
}

/**
 * Bounded website crawl for contact discovery.
 * Order: initial nav-driven plan → location pages → up to MAX_CONTACT_BRANCH_PAGES branch pages.
 */
export async function crawlContactPagesBounded(
  baseUrl: string,
  fetchHtml: ContactCrawlFetchHtml,
  homeHtmlPrefetched?: string | null,
): Promise<{ visits: ContactCrawlPageVisit[]; pages_scanned: number }> {
  const base = new URL(baseUrl)
  const home = normalizePageUrl(new URL('/', base).toString(), base)
  const homeHtml = homeHtmlPrefetched ?? (await fetchHtml(home))
  const initialPlan = buildInitialCrawlPlan(baseUrl, homeHtml)

  const queue: PlannedCrawlPage[] = [...initialPlan]
  const queued = new Set(queue.map((p) => p.url))
  const visits: ContactCrawlPageVisit[] = []
  let branchPagesQueued = 0

  for (let i = 0; i < queue.length && visits.length < MAX_CONTACT_SCAN_PAGES; i++) {
    const page = queue[i]
    const html = page.url === home && homeHtmlPrefetched != null ? homeHtmlPrefetched : await fetchHtml(page.url)
    visits.push({ page, html })

    if (!html) continue
    if (page.page_kind !== 'location' || branchPagesQueued >= MAX_CONTACT_BRANCH_PAGES) continue

    for (const branch of discoverBranchPagesFromHtml(html, page.url, baseUrl)) {
      if (branchPagesQueued >= MAX_CONTACT_BRANCH_PAGES) break
      if (queued.has(branch.url)) continue
      queued.add(branch.url)
      queue.push(branch)
      branchPagesQueued += 1
    }
  }

  return { visits, pages_scanned: visits.length }
}
