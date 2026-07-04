import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ContactResult } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import {
  applyOutreachRankingAndRecommendations,
  compareContactsForOutreachReview,
  computeOutreachPriority,
  explainOutreachRecommendation,
  rankContactResults,
  selectRecommendedContacts,
} from '@/lib/sales/providers/contactOutreachRanking'

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

describe('computeOutreachPriority', () => {
  it('ranks branch sales above high-confidence accounts without using confidence', () => {
    const sales = computeOutreachPriority({
      contact_type: 'sales',
      page_kind: 'branch',
      discovery_method: 'mailto_labeled',
      email: 'thomastownsales@example.com',
    })
    const accounts = computeOutreachPriority({
      contact_type: 'accounts',
      page_kind: 'homepage',
      discovery_method: 'body_text',
      email: 'creditapps@example.com',
    })
    assert.ok(sales > accounts)
  })
})

describe('explainOutreachRecommendation', () => {
  it('uses approved reason phrases', () => {
    assert.equal(
      explainOutreachRecommendation({
        contact_type: 'sales',
        page_kind: 'branch',
        discovery_method: 'mailto_labeled',
        link_label: 'Email Us',
        email: 'branchsales@example.com',
      }),
      'Branch sales contact',
    )
    assert.equal(
      explainOutreachRecommendation({
        contact_type: 'general',
        page_kind: 'contact',
        discovery_method: 'mailto',
        email: 'info@example.com',
      }),
      'Found on Contact Us page',
    )
    assert.equal(
      explainOutreachRecommendation({
        contact_type: 'sales',
        page_kind: 'homepage',
        discovery_method: 'body_text',
        email: 'sales@example.com',
      }),
      'Sales email detected',
    )
    assert.equal(
      explainOutreachRecommendation({
        contact_type: 'general',
        page_kind: 'homepage',
        discovery_method: 'body_text',
        email: 'hello@example.com',
      }),
      'General enquiries contact',
    )
    assert.equal(
      explainOutreachRecommendation({
        contact_type: 'sales',
        page_kind: 'branch',
        discovery_method: 'mailto_labeled',
        link_label: 'Email Us',
        email: 's@example.com',
      }),
      'Branch sales contact',
    )
    assert.equal(
      explainOutreachRecommendation({
        contact_type: 'general',
        page_kind: 'quote',
        discovery_method: 'mailto_labeled',
        link_label: 'Email Us',
        email: 'q@example.com',
      }),
      'Mailto from Email Us button',
    )
  })
})

describe('rankContactResults', () => {
  it('orders by outreach priority not extraction confidence alone', () => {
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
        confidence_score: 52,
      }),
    ])
    assert.equal(ranked[0]?.email, 'thomastownsales@example.com')
    assert.equal(ranked[0]?.confidence_score, 52)
  })
})

describe('selectRecommendedContacts', () => {
  it('picks top outreach contact with reason', () => {
    const picks = selectRecommendedContacts([
      emailResult({
        email: 'credit@example.com',
        contact_type: 'accounts',
        confidence_score: 99,
        page_kind: 'homepage',
        discovery_method: 'body_text',
      }),
      emailResult({
        email: 'thomastownsales@example.com',
        contact_type: 'sales',
        confidence_score: 80,
      }),
    ])
    assert.equal(picks.length, 1)
    assert.equal(picks[0]?.result.email, 'thomastownsales@example.com')
    assert.equal(picks[0]?.reason, 'Branch sales contact')
  })
})

describe('applyOutreachRankingAndRecommendations', () => {
  it('marks recommended_for_outreach without changing confidence_score', () => {
    const input = emailResult({
      email: 'sales@example.com',
      confidence_score: 77,
      contact_type: 'sales',
      page_kind: 'contact',
      discovery_method: 'mailto',
    })
    const [out] = applyOutreachRankingAndRecommendations([input], 1)
    assert.equal(out?.recommended_for_outreach, true)
    assert.equal(out?.recommended_reason, 'Found on Contact Us page')
    assert.equal(out?.confidence_score, 77)
  })
})

describe('compareContactsForOutreachReview', () => {
  it('sorts recommended before higher outreach priority', () => {
    const recommendedIds = new Set(['low-priority-rec'])
    const lowPriorityRec = {
      id: 'low-priority-rec',
      business_id: 'b1',
      email: 'info@example.com',
      contact_type: 'general' as const,
      confidence_score: 99,
      recommended_for_outreach: true,
      page_kind: 'homepage' as const,
      discovery_method: 'body_text' as const,
    }
    const highPriority = {
      id: 'high-priority',
      business_id: 'b1',
      email: 'branch@example.com',
      contact_type: 'sales' as const,
      confidence_score: 50,
      recommended_for_outreach: false,
      page_kind: 'branch' as const,
      discovery_method: 'mailto_labeled' as const,
    }
    assert.ok(
      compareContactsForOutreachReview(lowPriorityRec, highPriority, recommendedIds) < 0,
    )
  })

  it('uses outreach priority then confidence when recommendation ties', () => {
    const recommendedIds = new Set<string>()
    const sales = {
      id: 'a',
      business_id: 'b1',
      email: 'sales@example.com',
      contact_type: 'sales' as const,
      confidence_score: 60,
      recommended_for_outreach: false,
      page_kind: 'contact' as const,
      discovery_method: 'mailto' as const,
    }
    const support = {
      id: 'b',
      business_id: 'b1',
      email: 'help@example.com',
      contact_type: 'support' as const,
      confidence_score: 95,
      recommended_for_outreach: false,
      page_kind: 'contact' as const,
      discovery_method: 'mailto' as const,
    }
    assert.ok(compareContactsForOutreachReview(sales, support, recommendedIds) < 0)
  })
})
