import { crawlContactPagesBounded } from '@/lib/sales/providers/contactCrawlPlanner'
import {
  dedupeContactResults,
  extractContactsFromHtml,
} from '@/lib/sales/providers/contactHtmlExtraction'
import { applyOutreachRankingAndRecommendations } from '@/lib/sales/providers/contactOutreachRanking'
import { normalizePageUrl } from '@/lib/sales/providers/contactPageDiscovery'
import type { ContactDiscoveryProvider } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import { fetchHtmlPage, normalizeWebsiteUrl } from '@/lib/sales/providers/websiteFetch'

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
      aggregated.push(...extractContactsFromHtml(html, page.url, page.page_kind))
    }

    return {
      results: applyOutreachRankingAndRecommendations(dedupeContactResults(aggregated), 1),
      pages_scanned,
    }
  },
}
