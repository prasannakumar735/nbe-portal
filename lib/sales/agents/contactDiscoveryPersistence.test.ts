import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDiscoveryUpsertRows,
  countPersistableEmails,
  resolveDiscoveryRecommendations,
} from '@/lib/sales/agents/contactDiscoveryPersistence'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import type { SalesContact } from '@/lib/sales/types/contact.types'

function result(partial: Partial<ContactResult> & Pick<ContactResult, 'email'>): ContactResult {
  return {
    phone: null,
    contact_page: 'https://example.com/contact',
    contact_type: 'sales',
    confidence_score: 80,
    source: 'website_scan',
    discovery_page_title: 'Contact',
    discovery_method: 'mailto_labeled',
    page_kind: 'contact',
    ...partial,
    email: partial.email,
  }
}

describe('buildDiscoveryUpsertRows', () => {
  it('maps scan metadata without recommendation flags', () => {
    const rows = buildDiscoveryUpsertRows(
      'biz-1',
      [
        result({
          email: 'sales@example.com',
          recommended_for_outreach: true,
          recommended_reason: 'Sales email detected',
        }),
      ],
      '2026-07-05T00:00:00.000Z',
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.recommended_for_outreach, false)
    assert.equal(rows[0]?.recommended_reason, null)
    assert.equal(rows[0]?.discovery_method, 'mailto_labeled')
  })
})

describe('resolveDiscoveryRecommendations', () => {
  it('maps recommended scan results to persisted contact ids', () => {
    const recs = resolveDiscoveryRecommendations(
      [
        result({
          email: 'sales@example.com',
          recommended_for_outreach: true,
          recommended_reason: 'Branch sales contact',
        }),
      ],
      [
        {
          id: 'c1',
          business_id: 'biz-1',
          email: 'sales@example.com',
        } as SalesContact,
      ],
    )
    assert.deepEqual(recs, [
      { contactId: 'c1', email: 'sales@example.com', reason: 'Branch sales contact' },
    ])
  })
})

describe('countPersistableEmails', () => {
  it('counts email contacts discovered in scan', () => {
    assert.equal(
      countPersistableEmails([
        result({ email: 'a@example.com' }),
        result({ email: 'b@example.com' }),
        { ...result({ email: 'c@example.com' }), email: null } as ContactResult,
      ]),
      2,
    )
  })
})
