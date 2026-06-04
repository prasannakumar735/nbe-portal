import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addMonthsToIsoDate, serviceReminderNotifyIsoDate } from './dueDate'

describe('addMonthsToIsoDate', () => {
  it('adds six months', () => {
    assert.equal(addMonthsToIsoDate('2026-03-15', 6), '2026-09-15')
  })
})

describe('serviceReminderNotifyIsoDate', () => {
  it('subtracts lead time from due date', () => {
    assert.equal(serviceReminderNotifyIsoDate('2026-09-15', 14), '2026-09-01')
  })
})
