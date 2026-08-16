import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEngagementTrackingUrls,
  signEngagementTrackingToken,
  signUnsubscribeToken,
  verifyEngagementTrackingToken,
  verifyUnsubscribeToken,
} from '@/lib/sales/engagement/engagementTrackingToken'

describe('engagementTrackingToken', () => {
  it('round-trips signed payload', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    const token = signEngagementTrackingToken({
      campaignId: '00000000-0000-0000-0000-000000000001',
      contactId: '00000000-0000-0000-0000-000000000002',
      generatedEmailId: '00000000-0000-0000-0000-000000000003',
    })
    const payload = verifyEngagementTrackingToken(token)
    assert.equal(payload.campaignId, '00000000-0000-0000-0000-000000000001')
    assert.equal(payload.contactId, '00000000-0000-0000-0000-000000000002')
  })

  const subject = {
    campaignId: '00000000-0000-0000-0000-000000000001',
    contactId: '00000000-0000-0000-0000-000000000002',
    generatedEmailId: '00000000-0000-0000-0000-000000000003',
  }

  it('unsubscribe tokens never expire', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    const payload = verifyUnsubscribeToken(signUnsubscribeToken(subject))
    assert.equal(payload.exp, undefined, 'no expiry on unsubscribe tokens')
    assert.equal(payload.purpose, 'unsubscribe')
  })

  it('rejects an expired engagement token', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    const expired = signEngagementTrackingToken(subject, -10)
    assert.throws(() => verifyEngagementTrackingToken(expired), /expired/i)
  })

  it('an engagement token cannot be replayed against unsubscribe', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    const engagementToken = signEngagementTrackingToken(subject)
    assert.throws(() => verifyUnsubscribeToken(engagementToken), /not valid for unsubscribe/i)
  })

  it('rejects a tampered signature', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    const [body] = signUnsubscribeToken(subject).split('.')
    assert.throws(() => verifyUnsubscribeToken(`${body}.deadbeef`), /signature|Invalid/i)
  })

  it('refuses to build links without NEXT_PUBLIC_APP_URL', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    const previous = process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    try {
      assert.throws(() => buildEngagementTrackingUrls(subject), /NEXT_PUBLIC_APP_URL/)
    } finally {
      if (previous !== undefined) process.env.NEXT_PUBLIC_APP_URL = previous
    }
  })

  it('builds distinct open and unsubscribe URLs', () => {
    process.env.SALES_ENGAGEMENT_TRACKING_SECRET = 'test-secret-phase-10'
    process.env.NEXT_PUBLIC_APP_URL = 'https://portal.example.com/'
    const { openUrl, unsubscribeUrl } = buildEngagementTrackingUrls(subject)
    assert.ok(openUrl.startsWith('https://portal.example.com/api/sales/tracking/open/'))
    assert.ok(unsubscribeUrl.startsWith('https://portal.example.com/api/sales/tracking/unsubscribe/'))
    assert.notEqual(openUrl, unsubscribeUrl)
  })
})
