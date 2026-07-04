import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyContactFromEmail } from '@/lib/sales/providers/contactClassification'
import {
  discoverContactPageUrls,
  linkLooksLikeContactPage,
} from '@/lib/sales/providers/contactPageDiscovery'
import { pickRecommendedOutreachContactIds } from '@/lib/sales/providers/contactOutreachRanking'

describe('classifyContactFromEmail', () => {
  it('classifies branch sales addresses', () => {
    assert.equal(classifyContactFromEmail('thomastownsales@example.com'), 'sales')
  })

  it('classifies finance inboxes as accounts', () => {
    assert.equal(classifyContactFromEmail('creditappsarc@example.com'), 'accounts')
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
