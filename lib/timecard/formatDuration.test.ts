import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatDurationHm, grossMinutesBetween } from './formatDuration'

describe('formatDurationHm', () => {
  it('formats hours and minutes', () => {
    assert.equal(formatDurationHm(534), '8h 54m')
    assert.equal(formatDurationHm(60), '1h')
    assert.equal(formatDurationHm(45), '45m')
    assert.equal(formatDurationHm(0), '0m')
  })
})

describe('grossMinutesBetween', () => {
  it('floors to whole minutes', () => {
    const a = new Date('2026-06-10T07:50:00.000Z')
    const b = new Date('2026-06-10T16:44:30.000Z')
    assert.ok(grossMinutesBetween(a, b) >= 534)
  })
})
