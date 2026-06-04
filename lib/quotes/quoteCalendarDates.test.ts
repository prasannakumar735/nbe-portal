import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDaysIso, formatQuoteDisplayDate } from './quoteCalendarDates'

describe('formatQuoteDisplayDate', () => {
  it('formats YYYY-MM-DD as DD-MM-YYYY', () => {
    assert.equal(formatQuoteDisplayDate('2026-06-05'), '05-06-2026')
  })

  it('passes through non-ISO strings', () => {
    assert.equal(formatQuoteDisplayDate('n/a'), 'n/a')
  })
})

describe('addCalendarDaysIso', () => {
  it('adds calendar days', () => {
    assert.equal(addCalendarDaysIso('2026-06-05', 30), '2026-07-05')
  })
})
