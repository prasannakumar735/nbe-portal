import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldSendFollowup } from '@/lib/sales/followup/followupDecisionEngine'
import { formatThreadContextBlock } from '@/lib/sales/followup/followupThreadContext'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

describe('shouldSendFollowup', () => {
  it('blocks follow-up 4', () => {
    const result = shouldSendFollowup({
      engagement: null,
      sequence: null,
      followupNumber: 4,
      scheduledAt: new Date().toISOString(),
      sentFollowupCount: 3,
    })
    assert.equal(result.shouldSend, false)
  })

  it('allows follow-up 1 when due and no reply', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const result = shouldSendFollowup({
      engagement: null,
      sequence: null,
      followupNumber: 1,
      scheduledAt: past,
      sentFollowupCount: 0,
    })
    assert.equal(result.shouldSend, true)
  })
})

describe('formatThreadContextBlock', () => {
  it('includes anti-repeat guidance', () => {
    const block = formatThreadContextBlock([
      {
        id: '1',
        subject: 'Hello',
        body: 'Body one',
      } as SalesGeneratedEmail,
    ])
    assert.ok(block.includes('do not copy wording'))
    assert.ok(block.includes('Hello'))
  })
})
