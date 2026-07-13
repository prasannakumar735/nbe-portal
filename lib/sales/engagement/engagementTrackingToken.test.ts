import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  signEngagementTrackingToken,
  verifyEngagementTrackingToken,
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
})
