import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Resend rules are enforced in emailResendService (integration).
 * This documents expected guard messages for unit-level regression.
 */
describe('email resend policy', () => {
  it('only failed or cancelled queue rows are eligible', () => {
    const eligible = new Set(['failed', 'cancelled'])
    assert.ok(eligible.has('failed'))
    assert.ok(!eligible.has('sent'))
  })
})
