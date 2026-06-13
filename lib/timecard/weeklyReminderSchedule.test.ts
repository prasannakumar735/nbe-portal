import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addCalendarDays } from '@/lib/officeClock/attendanceRange'
import { melbourneLocalYmdHmToUtc } from '@/lib/officeClock/melbourneWallClock'
import {
  formatDdMmYyyy,
  isAutoSubmitDue,
  isReminder1Window,
  isReminder2Day,
  melbourneWeekday,
  priorWeekStart,
} from '@/lib/timecard/weeklyReminderSchedule'

describe('weeklyReminderSchedule', () => {
  it('formatDdMmYyyy', () => {
    assert.equal(formatDdMmYyyy('2026-06-09'), '09/06/2026')
  })

  it('priorWeekStart', () => {
    assert.equal(priorWeekStart('2026-06-09'), '2026-06-01')
  })

  it('isReminder1Window on Friday 17:00 Melbourne', () => {
    const fri5pm = melbourneLocalYmdHmToUtc('2026-06-12', '17:00')
    assert.equal(melbourneWeekday(fri5pm), 5)
    assert.equal(isReminder1Window(fri5pm), true)
    const fri4pm = melbourneLocalYmdHmToUtc('2026-06-12', '16:59')
    assert.equal(isReminder1Window(fri4pm), false)
  })

  it('isReminder2Day on Monday', () => {
    const mon = melbourneLocalYmdHmToUtc('2026-06-15', '10:00')
    assert.equal(isReminder2Day(mon), true)
    const tue = melbourneLocalYmdHmToUtc('2026-06-16', '10:00')
    assert.equal(isReminder2Day(tue), false)
  })

  it('isAutoSubmitDue two Melbourne days after reminder 2', () => {
    const sent = '2026-06-15T02:00:00.000Z'
    const mon = melbourneLocalYmdHmToUtc('2026-06-15', '12:00')
    assert.equal(isAutoSubmitDue(sent, mon), false)
    const wed = melbourneLocalYmdHmToUtc('2026-06-17', '12:00')
    assert.equal(isAutoSubmitDue(sent, wed), true)
    const dueDate = addCalendarDays('2026-06-15', 2)
    assert.equal(dueDate, '2026-06-17')
  })
})
