import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyContactFromEmail } from '@/lib/sales/providers/contactClassification'
import {
  discoverContactPageUrls,
  linkLooksLikeContactPage,
} from '@/lib/sales/providers/contactPageDiscovery'
import {
  computeOutreachPriority,
  pickRecommendedOutreachContactIds,
  rankContactResults,
} from '@/lib/sales/providers/contactOutreachRanking'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'

function emailResult(partial: Partial<ContactResult> & Pick<ContactResult, 'email'>): ContactResult {
  return {
    phone: null,
    contact_page: 'https://example.com/locations/thomastown',
    contact_type: 'sales',
    confidence_score: 90,
    source: 'website_scan',
    discovery_page_title: 'Thomastown',
    discovery_method: 'mailto_labeled',
    page_kind: 'branch',
    link_label: 'Email Us',
    ...partial,
    email: partial.email,
  }
}

describe('classifyContactFromEmail', () => {
  it('classifies branch sales addresses', () => {
    assert.equal(classifyContactFromEmail('thomastownsales@example.com'), 'sales')
  })

  it('classifies finance inboxes as accounts', () => {
    assert.equal(classifyContactFromEmail('creditappsarc@example.com'), 'accounts')
  })
})

describe('computeOutreachPriority', () => {
  it('ranks branch sales above high-confidence accounts', () => {
    const sales = computeOutreachPriority({
      contact_type: 'sales',
      confidence_score: 85,
      page_kind: 'branch',
      discovery_method: 'mailto_labeled',
      email: 'thomastownsales@example.com',
    })
    const accounts = computeOutreachPriority({
      contact_type: 'accounts',
      confidence_score: 99,
      page_kind: 'homepage',
      discovery_method: 'body_text',
      email: 'creditapps@example.com',
    })
    assert.ok(sales > accounts)
  })
})

describe('rankContactResults', () => {
  it('orders by outreach priority not confidence alone', () => {
    const ranked = rankContactResults([
      emailResult({
        email: 'creditapps@example.com',
        contact_type: 'accounts',
        confidence_score: 99,
        page_kind: 'homepage',
        discovery_method: 'body_text',
      }),
      emailResult({
        email: 'thomastownsales@example.com',
        contact_type: 'sales',
        confidence_score: 85,
      }),
    ])
    assert.equal(ranked[0]?.email, 'thomastownsales@example.com')
  })
})

describe('linkLooksLikeContactPage', () => {
  it('matches common CTA labels and paths', () => {
    assert.equal(linkLooksLikeContactPage('Email Us', '/products'), true)
    assert.equal(linkLooksLikeContactPage('Products', '/locations/thomastown'), true)
    assert.equal(linkLooksLikeContactPage('Blog', '/news'), false)
  })
})

describe('discoverContactPageUrls', () => {
  it('finds same-site contact links from homepage HTML', () => {
    const html = `
      <html><body>
        <a href="/contact-us">Contact Us</a>
        <a href="https://other.example/contact">External</a>
        <a href="mailto:sales@example.com">Email Us</a>
      </body></html>
    `
    const found = discoverContactPageUrls(html, 'https://example.com/', 'https://example.com')
    assert.deepEqual(found, ['https://example.com/contact-us'])
  })
})

describe('pickRecommendedOutreachContactIds', () => {
  it('uses persisted recommended_for_outreach when set', () => {
    const ids = pickRecommendedOutreachContactIds([
      {
        id: 'a',
        business_id: 'b1',
        email: 'credit@example.com',
        contact_type: 'accounts',
        confidence_score: 80,
        recommended_for_outreach: false,
        page_kind: 'homepage',
        discovery_method: 'body_text',
      },
      {
        id: 's',
        business_id: 'b1',
        email: 'thomastownsales@example.com',
        contact_type: 'sales',
        confidence_score: 78,
        recommended_for_outreach: true,
        page_kind: 'branch',
        discovery_method: 'mailto_labeled',
      },
    ])
    assert.deepEqual(ids, ['s'])
  })
})
