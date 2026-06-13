import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isForgottenOfficeSessionSyntheticEligible,
  syntheticClockOutInstantForSessionDay,
} from './forgottenSyntheticClose'
import { melbourneCalendarDate, melbourneLocalYmdHmToUtc } from './melbourneWallClock'

describe('isForgottenOfficeSessionSyntheticEligible', () => {
  it('returns true when clock-in Melbourne day is before today Melbourne', () => {
    const clockIn = melbourneLocalYmdHmToUtc('2026-06-10', '07:50')
    const now = melbourneLocalYmdHmToUtc('2026-06-11', '08:00')
    assert.equal(isForgottenOfficeSessionSyntheticEligible(clockIn, now), true)
  })

  it('returns false same Melbourne day before 17:00', () => {
    const clockIn = melbourneLocalYmdHmToUtc('2026-06-10', '08:00')
    const now = melbourneLocalYmdHmToUtc('2026-06-10', '16:30')
    assert.equal(isForgottenOfficeSessionSyntheticEligible(clockIn, now), false)
  })

  it('returns true same Melbourne day at or after 17:00', () => {
    const clockIn = melbourneLocalYmdHmToUtc('2026-06-10', '08:00')
    const now = melbourneLocalYmdHmToUtc('2026-06-10', '17:00')
    assert.equal(isForgottenOfficeSessionSyntheticEligible(clockIn, now), true)
  })
})

describe('syntheticClockOutInstantForSessionDay', () => {
  it('uses 16:00 Melbourne on session day', () => {
    const out = syntheticClockOutInstantForSessionDay('2026-06-10')
    assert.equal(melbourneCalendarDate(out), '2026-06-10')
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(out)
    const h = parts.find(p => p.type === 'hour')?.value
    const m = parts.find(p => p.type === 'minute')?.value
    assert.equal(`${h}:${m}`, '16:00')
  })
})
