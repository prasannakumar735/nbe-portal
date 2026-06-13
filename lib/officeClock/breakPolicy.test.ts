import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { officeClockBreakForGrossMinutes, officeClockBreakForTimeRange } from './breakPolicy'

describe('officeClockBreakForGrossMinutes', () => {
  it('returns 0 under 2 hours', () => {
    assert.equal(officeClockBreakForGrossMinutes(119), 0)
    assert.equal(officeClockBreakForGrossMinutes(0), 0)
  })

  it('returns 15 from 2h up to under 5h', () => {
    assert.equal(officeClockBreakForGrossMinutes(120), 15)
    assert.equal(officeClockBreakForGrossMinutes(299), 15)
  })

  it('returns 30 at 5h and above', () => {
    assert.equal(officeClockBreakForGrossMinutes(300), 30)
    assert.equal(officeClockBreakForGrossMinutes(540), 30)
  })
})

describe('officeClockBreakForTimeRange', () => {
  it('uses gross span between times', () => {
    assert.equal(officeClockBreakForTimeRange('09:00', '10:00'), 0)
    assert.equal(officeClockBreakForTimeRange('09:00', '12:00'), 15)
    assert.equal(officeClockBreakForTimeRange('07:00', '16:00'), 30)
  })
})
