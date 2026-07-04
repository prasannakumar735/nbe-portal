import * as cheerio from 'cheerio'
import { assertPublicWebsiteUrl } from '@/lib/sales/providers/websiteFetch'

const CONTACT_LABEL_RE =
  /\b(contact\s*us|email\s*us|get\s*(a\s*)?quote|request\s*(a\s*)?quote|sales|locations?|branches|find\s*us|our\s*locations|enquir|inquir|offices|service)\b/i

const CONTACT_PATH_RE =
  /\/(contact(?:-us)?|about(?:-us)?|sales|locations?|branches|quote|get-quote|request-quote|find-us|stores|depots|showrooms?|offices|service)(?:\/|$)/i

const LOCATIONS_HUB_RE =
  /\/(locations?|branches|find-us|offices|stores|depots|showrooms?)(?:\/|$)/i

const EXCLUDE_PATH_RE =
  /\/(blog|news|media|articles?|press|product|products|shop|cart|catalog|pdf|download|careers|jobs|vacancies)(?:\/|$|\.)/i

export function normalizePageUrl(raw: string, base: URL): string {
  const link = new URL(raw, base)
  link.hash = ''
  let href = link.toString()
  if (href.endsWith('/') && link.pathname !== '/') {
    href = href.slice(0, -1)
  }
  return href
}

export function isSameSite(base: URL, link: URL): boolean {
  return link.hostname.toLowerCase() === base.hostname.toLowerCase()
}

export function shouldExcludeCrawlPath(pathname: string, href: string): boolean {
  const lowerHref = href.toLowerCase()
  if (lowerHref.endsWith('.pdf') || lowerHref.includes('.pdf?')) return true
  return EXCLUDE_PATH_RE.test(pathname.toLowerCase())
}

export function linkLooksLikeContactPage(linkText: string, pathname: string): boolean {
  const label = linkText.trim().replace(/\s+/g, ' ')
  if (CONTACT_LABEL_RE.test(label)) return true
  if (CONTACT_PATH_RE.test(pathname)) return true
  return false
}

export function linkLooksLikeLocationsHub(linkText: string, pathname: string): boolean {
  const label = linkText.trim().replace(/\s+/g, ' ')
  if (/\b(locations?|branches|find\s*us|offices)\b/i.test(label)) return true
  return LOCATIONS_HUB_RE.test(pathname)
}

export function looksLikeBranchPage(linkText: string, pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return false
  const parent = segments[segments.length - 2]?.toLowerCase() ?? ''
  if (!/(location|branch|store|depot|office|showroom)/.test(parent)) {
    if (!LOCATIONS_HUB_RE.test(`/${segments[0]}/`)) return false
  }
  const label = linkText.trim()
  if (label.length > 2 && !/^(read more|learn more|view)$/i.test(label)) return true
  return segments.length >= 2 && !LOCATIONS_HUB_RE.test(pathname)
}

export function discoverContactPageUrls(html: string, pageUrl: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const out: string[] = []

  $('a[href]').each((_, el) => {
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
      const label = $(el).text() ?? ''
      if (linkLooksLikeContactPage(label, link.pathname) && !seen.has(normalized)) {
        seen.add(normalized)
        out.push(normalized)
      }
    } catch {
      /* ignore invalid links */
    }
  })

  return out
}

export function pageIntentBoost(pathname: string): number {
  const p = pathname.toLowerCase()
  if (p.includes('contact')) return 18
  if (p.includes('sales')) return 16
  if (/(location|branch|store|depot|showroom)/.test(p)) return 14
  if (/(quote|enquir|inquir)/.test(p)) return 12
  if (p.includes('about')) return 8
  return 0
}

export function readPageTitle(html: string): string | null {
  const $ = cheerio.load(html)
  const title = $('title').first().text().trim()
  return title.length > 0 ? title.slice(0, 500) : null
}
