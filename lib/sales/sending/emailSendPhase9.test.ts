import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyDeliveryFailure } from '@/lib/sales/sending/deliveryFailureClassifier'
import { sendEmail } from '@/lib/sales/sending/emailSenderAdapter'
import {
  acquireEmailSendRateLimit,
  getEmailSendRateLimitPerMinute,
  resetEmailSendRateLimitForTests,
} from '@/lib/sales/sending/emailSendRateLimiter'
import { calculateNextRetryTime } from '@/lib/sales/sending/retryScheduler'

describe('emailSendRateLimiter', () => {
  it('allows sends under the per-minute cap', async () => {
    resetEmailSendRateLimitForTests()
    await acquireEmailSendRateLimit()
    await acquireEmailSendRateLimit()
    assert.ok(getEmailSendRateLimitPerMinute() >= 1)
  })
})

describe('classifyDeliveryFailure (Graph)', () => {
  it('classifies Graph 429 as provider_error for retry', () => {
    const result = classifyDeliveryFailure(
      new Error('Microsoft Graph sendMail failed (429): {"error":"TooManyRequests"}'),
    )
    assert.equal(result.status, 'provider_error')
    assert.equal(result.queueStatus, 'failed')
  })
})

describe('sendEmail compliance gate', () => {
  const base = {
    recipient: 'ops@warehouse.example.com',
    subject: 'Cold store strip curtains',
    provider: 'microsoft365',
  }

  it('refuses to send without an unsubscribe URL', async () => {
    await assert.rejects(
      sendEmail({ ...base, body: 'Hello there', unsubscribeUrl: '' }),
      /unsubscribe URL is required/i,
    )
  })

  it('refuses to send when the body does not contain the unsubscribe link', async () => {
    await assert.rejects(
      sendEmail({
        ...base,
        body: 'Hello there — no footer here',
        unsubscribeUrl: 'https://portal.example.com/api/sales/tracking/unsubscribe/tok.sig',
      }),
      /compliance footer missing/i,
    )
  })
})

describe('retryScheduler', () => {
  it('schedules backoff for attempt 1', () => {
    const plan = calculateNextRetryTime(1, new Date('2026-01-01T00:00:00Z'))
    assert.ok('scheduledAt' in plan)
  })

  it('permanent failure at attempt 4', () => {
    const plan = calculateNextRetryTime(4)
    assert.ok('permanentFailure' in plan)
  })
})
