import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findOverlappingEvents } from './overlap'
import type { CalendarEventRow } from './types'

function ev(partial: Partial<CalendarEventRow> & Pick<CalendarEventRow, 'id' | 'assigned_to' | 'event_type' | 'date'>): CalendarEventRow {
  return {
    title: 'T',
    description: null,
    created_by: partial.assigned_to ?? 'c',
    client_id: null,
    location_id: null,
    location_mode: 'manual',
    location_text: null,
    location_lat: null,
    location_lng: null,
    travel_minutes: 0,
    total_minutes: 60,
    is_full_day: false,
    duration_minutes: 60,
    start_time: '09:00:00',
    end_time: null,
    end_date: null,
    status: 'scheduled',
    created_at: '',
    updated_at: '',
    ...partial,
  } as CalendarEventRow
}

describe('findOverlappingEvents (multi-assignee)', () => {
  it('flags overlap when any assignee id intersects on same day/time', () => {
    const existing = [
      ev({
        id: 'a',
        assigned_to: 'u1',
        assignees: [{ id: 'u1', full_name: 'A' }],
        event_type: 'task',
        date: '2026-05-20',
        duration_minutes: 60,
        start_time: '09:00:00',
        travel_minutes: 0,
        total_minutes: 60,
      }),
    ]
    const hits = findOverlappingEvents(
      {
        date: '2026-05-20',
        event_type: 'task',
        assigned_to: 'u2',
        assignee_ids: ['u2', 'u1'],
        window: { start: 9 * 60, end: 10 * 60, isFullDay: false },
      },
      existing,
    )
    assert.equal(hits.length, 1)
  })

  it('no overlap when disjoint assignees share a time window', () => {
    const existing = [
      ev({
        id: 'b',
        assigned_to: 'u1',
        assignees: [{ id: 'u1', full_name: 'A' }],
        event_type: 'task',
        date: '2026-05-20',
        duration_minutes: 60,
        start_time: '09:00:00',
        travel_minutes: 0,
        total_minutes: 60,
      }),
    ]
    const hits = findOverlappingEvents(
      {
        date: '2026-05-20',
        event_type: 'task',
        assigned_to: 'u2',
        assignee_ids: ['u2'],
        window: { start: 9 * 60, end: 10 * 60, isFullDay: false },
      },
      existing,
    )
    assert.equal(hits.length, 0)
  })
})
