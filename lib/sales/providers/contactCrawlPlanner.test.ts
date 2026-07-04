import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildInitialCrawlPlan,
  capHubPagesInPlan,
  classifyPageKind,
  discoverBranchPagesFromHtml,
  discoverHubPagesFromHtml,
} from '@/lib/sales/providers/contactCrawlPlanner'
import { MAX_CONTACT_HUB_PAGES } from '@/lib/sales/providers/websiteFetch'

describe('classifyPageKind', () => {
  it('uses canonical page kinds only', () => {
    assert.equal(classifyPageKind('/', 'Home'), 'homepage')
    assert.equal(classifyPageKind('/contact-us', 'Contact'), 'contact')
    assert.equal(classifyPageKind('/locations', 'Locations'), 'location')
    assert.equal(classifyPageKind('/locations/thomastown', 'Thomastown'), 'branch')
    assert.equal(classifyPageKind('/get-quote', 'Quote'), 'quote')
  })
})

describe('discoverHubPagesFromHtml', () => {
  it('prefers navigation links for hub discovery', () => {
    const html = `
      <html><body>
        <nav><a href="/contact-us">Contact Us</a></nav>
        <footer><a href="/blog/contact-fake">Contact</a></footer>
      </body></html>
    `
    const hubs = discoverHubPagesFromHtml(html, 'https://example.com/', 'https://example.com')
    assert.ok(hubs.some((h) => h.url.endsWith('/contact-us')))
    assert.equal(hubs.some((h) => h.url.includes('blog')), false)
  })
})

describe('discoverBranchPagesFromHtml', () => {
  it('finds branch pages linked from a locations hub', () => {
    const html = `
      <html><body>
        <a href="/locations/thomastown">Thomastown</a>
      </body></html>
    `
    const branches = discoverBranchPagesFromHtml(
      html,
      'https://example.com/locations',
      'https://example.com',
    )
    assert.equal(branches.length, 1)
    assert.equal(branches[0]?.page_kind, 'branch')
  })
})

describe('capHubPagesInPlan', () => {
  it('limits hub pages while keeping homepage', () => {
    const hubs = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/hub-${i}`,
      page_kind: 'contact' as const,
    }))
    const plan = capHubPagesInPlan([
      { url: 'https://example.com/', page_kind: 'homepage' },
      ...hubs,
    ])
    assert.equal(plan.filter((p) => p.page_kind === 'homepage').length, 1)
    assert.equal(plan.length, 1 + MAX_CONTACT_HUB_PAGES)
  })
})

describe('buildInitialCrawlPlan', () => {
  it('falls back to seed paths when nav finds nothing', () => {
    const plan = buildInitialCrawlPlan('https://example.com', '<html><body></body></html>')
    assert.ok(plan.some((p) => p.page_kind === 'homepage'))
    assert.ok(plan.some((p) => p.url.includes('/contact')))
  })
})
