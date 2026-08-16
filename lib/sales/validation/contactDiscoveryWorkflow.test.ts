import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDiscoveryUpsertRows,
  resolveDiscoveryRecommendations,
} from '@/lib/sales/agents/contactDiscoveryPersistence'
import { crawlContactPagesBounded } from '@/lib/sales/providers/contactCrawlPlanner'
import {
  dedupeContactResults,
  extractContactsFromHtml,
} from '@/lib/sales/providers/contactHtmlExtraction'
import {
  applyOutreachRankingAndRecommendations,
  compareContactsForOutreachReview,
  pickRecommendedOutreachContactIds,
} from '@/lib/sales/providers/contactOutreachRanking'
import { MAX_CONTACT_SCAN_PAGES } from '@/lib/sales/providers/websiteFetch'
import type { SalesContact } from '@/lib/sales/types/contact.types'

const HOME_HTML = `
<html><head><title>Acme Doors</title></head><body>
  <nav>
    <a href="/contact-us">Contact Us</a>
    <a href="/locations">Locations</a>
  </nav>
</body></html>
`

const CONTACT_HTML = `
<html><head><title>Contact Us</title></head><body>
  <a href="mailto:credit@example.com">Email Us</a>
</body></html>
`

const LOCATIONS_HTML = `
<html><head><title>Locations</title></head><body>
  <a href="/locations/thomastown">Thomastown</a>
</body></html>
`

const BRANCH_HTML = `
<html><head><title>Thomastown</title></head><body>
  <a href="mailto:thomastownsales@example.com">Email Us</a>
</body></html>
`

function htmlByUrl(url: string): string | null {
  const path = new URL(url).pathname.replace(/\/$/, '') || '/'
  if (path === '/') return HOME_HTML
  if (path === '/contact-us') return CONTACT_HTML
  if (path === '/locations') return LOCATIONS_HTML
  if (path === '/locations/thomastown') return BRANCH_HTML
  return null
}

describe('contact discovery workflow (integration)', () => {
  it('nav-first crawl discovers contact and branch pages within scan budget', async () => {
    const fetchCalls: string[] = []
    const fetchHtml = async (url: string) => {
      fetchCalls.push(url)
      return htmlByUrl(url)
    }

    const { visits, pages_scanned } = await crawlContactPagesBounded(
      'https://acme.example',
      fetchHtml,
      HOME_HTML,
    )

    assert.ok(pages_scanned <= MAX_CONTACT_SCAN_PAGES)
    assert.ok(visits.some((v) => v.page.page_kind === 'contact'))
    assert.ok(visits.some((v) => v.page.page_kind === 'branch'))
    const homeFetches = fetchCalls.filter((u) => new URL(u).pathname === '/')
    assert.equal(homeFetches.length, 0, 'homepage should use prefetched HTML without refetch')
  })

  it('extract → classify → rank → recommend branch sales over general contact', () => {
    const aggregated = []
    for (const { page, html } of [
      {
        page: { url: 'https://acme.example/contact-us', page_kind: 'contact' as const },
        html: CONTACT_HTML,
      },
      {
        page: { url: 'https://acme.example/locations/thomastown', page_kind: 'branch' as const },
        html: BRANCH_HTML,
      },
    ]) {
      aggregated.push(...extractContactsFromHtml(html, page.url, page.page_kind))
    }

    const deduped = dedupeContactResults(aggregated)
    assert.equal(deduped.length, 2)

    const ranked = applyOutreachRankingAndRecommendations(deduped, 1)
    const recommended = ranked.filter((r) => r.recommended_for_outreach)
    assert.equal(recommended.length, 1)
    assert.equal(recommended[0]?.email, 'thomastownsales@example.com')
    assert.equal(recommended[0]?.contact_type, 'sales')
    assert.equal(recommended[0]?.discovery_method, 'mailto_labeled')
  })

  it('dedupes duplicate emails from multiple pages before persistence mapping', () => {
    const duped = dedupeContactResults([
      ...extractContactsFromHtml(CONTACT_HTML, 'https://acme.example/contact-us', 'contact'),
      ...extractContactsFromHtml(CONTACT_HTML, 'https://acme.example/contact', 'contact'),
    ])
    assert.equal(duped.length, 1)
  })

  it('rescan upsert rows refresh metadata without duplicating recommendation on insert row', () => {
    const scanAt = '2026-07-05T12:00:00.000Z'
    const first = buildDiscoveryUpsertRows(
      'biz-1',
      applyOutreachRankingAndRecommendations(
        dedupeContactResults(
          extractContactsFromHtml(BRANCH_HTML, 'https://acme.example/locations/thomastown', 'branch'),
        ),
        1,
      ),
      scanAt,
    )
    const second = buildDiscoveryUpsertRows(
      'biz-1',
      applyOutreachRankingAndRecommendations(
        dedupeContactResults(
          extractContactsFromHtml(BRANCH_HTML, 'https://acme.example/locations/thomastown', 'branch'),
        ),
        1,
      ),
      '2026-07-06T12:00:00.000Z',
    )
    assert.equal(first.length, 1)
    assert.equal(second.length, 1)
    assert.equal(first[0]?.email, second[0]?.email)
    assert.equal(second[0]?.discovered_at, '2026-07-06T12:00:00.000Z')
    assert.equal(second[0]?.recommended_for_outreach, false)
  })

  it('campaign selection picks recommended id and allows sort order for review UI', () => {
    const scanIso = '2026-07-05T12:00:00.000Z'
    const persisted: SalesContact[] = [
      {
        id: 'c-info',
        business_id: 'biz-1',
        email: 'credit@example.com',
        phone: null,
        contact_page: 'https://acme.example/contact-us',
        contact_type: 'accounts',
        confidence_score: 90,
        is_primary: false,
        source: 'website_scan',
        email_verified: false,
        verification_status: 'unknown',
        created_at: scanIso,
        discovery_page_title: 'Contact Us',
        discovery_method: 'mailto_labeled',
        page_kind: 'contact',
        recommended_for_outreach: false,
        recommended_reason: null,
        discovered_at: scanIso,
      },
      {
        id: 'c-branch',
        business_id: 'biz-1',
        email: 'thomastownsales@example.com',
        phone: null,
        contact_page: 'https://acme.example/locations/thomastown',
        contact_type: 'sales',
        confidence_score: 85,
        is_primary: true,
        source: 'website_scan',
        email_verified: false,
        verification_status: 'unknown',
        created_at: scanIso,
        discovery_page_title: 'Thomastown',
        discovery_method: 'mailto_labeled',
        page_kind: 'branch',
        recommended_for_outreach: true,
        recommended_reason: 'Branch sales contact',
        discovered_at: scanIso,
      },
    ]

    const recs = resolveDiscoveryRecommendations(
      applyOutreachRankingAndRecommendations(
        dedupeContactResults(
          extractContactsFromHtml(BRANCH_HTML, 'https://acme.example/locations/thomastown', 'branch'),
        ),
        1,
      ),
      persisted,
    )
    assert.equal(recs[0]?.contactId, 'c-branch')

    const picks = pickRecommendedOutreachContactIds(
      persisted.map((c) => ({
        id: c.id,
        business_id: c.business_id,
        email: c.email,
        contact_type: c.contact_type,
        confidence_score: c.confidence_score,
        recommended_for_outreach: c.recommended_for_outreach,
        page_kind: c.page_kind,
        discovery_method: c.discovery_method,
        contact_page: c.contact_page,
        recommended_reason: c.recommended_reason,
      })),
    )
    assert.deepEqual(picks, ['c-branch'])

    const recommendedIds = new Set(picks)
    const sorted = [...persisted].sort((a, b) =>
      compareContactsForOutreachReview(
        {
          id: a.id,
          business_id: a.business_id,
          email: a.email,
          contact_type: a.contact_type,
          confidence_score: a.confidence_score,
          recommended_for_outreach: a.recommended_for_outreach,
          page_kind: a.page_kind,
          discovery_method: a.discovery_method,
        },
        {
          id: b.id,
          business_id: b.business_id,
          email: b.email,
          contact_type: b.contact_type,
          confidence_score: b.confidence_score,
          recommended_for_outreach: b.recommended_for_outreach,
          page_kind: b.page_kind,
          discovery_method: b.discovery_method,
        },
        recommendedIds,
      ),
    )
    assert.equal(sorted[0]?.id, 'c-branch')
  })
})
