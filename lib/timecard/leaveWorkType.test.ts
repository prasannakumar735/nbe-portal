import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLeaveLegacyTimeEntry,
  isLeaveLevel1Code,
  isLeaveTimesheetEntry,
  splitWorkAndLeaveHours,
} from './leaveWorkType'

describe('leaveWorkType', () => {
  it('isLeaveLevel1Code', () => {
    assert.equal(isLeaveLevel1Code('LVH'), true)
    assert.equal(isLeaveLevel1Code('lvh'), true)
    assert.equal(isLeaveLevel1Code(' FAB '), false)
    assert.equal(isLeaveLevel1Code(null), false)
  })

  it('isLeaveLegacyTimeEntry', () => {
    assert.equal(isLeaveLegacyTimeEntry({ work_type_level1_id: 'LVH' }), true)
    assert.equal(isLeaveLegacyTimeEntry({ work_type_level1_id: 'OPS' }), false)
  })

  it('isLeaveTimesheetEntry uses code map', () => {
    const map = new Map([['uuid-lvh', 'LVH'], ['uuid-fab', 'FAB']])
    assert.equal(isLeaveTimesheetEntry({ work_type_level1_id: 'uuid-lvh' }, map), true)
    assert.equal(isLeaveTimesheetEntry({ work_type_level1_id: 'uuid-fab' }, map), false)
    assert.equal(isLeaveTimesheetEntry({ work_type_level1_id: null }, map), false)
  })

  it('splitWorkAndLeaveHours mixed lines', () => {
    type Row = { leave: boolean; h: number }
    const rows: Row[] = [
      { leave: false, h: 8 },
      { leave: true, h: 8 },
      { leave: false, h: 2.5 },
    ]
    const split = splitWorkAndLeaveHours(
      rows,
      r => r.leave,
      r => r.h,
    )
    assert.equal(split.workHours, 10.5)
    assert.equal(split.leaveHours, 8)
    assert.equal(split.totalHours, 18.5)
  })

  it('splitWorkAndLeaveHours empty', () => {
    const split = splitWorkAndLeaveHours([], () => false, () => 0)
    assert.equal(split.totalHours, 0)
    assert.equal(split.workHours, 0)
    assert.equal(split.leaveHours, 0)
  })
})
