'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CalendarEventRow } from '@/lib/calendar/types'
import { EventCard } from '@/components/calendar/EventCard'
import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  CALENDAR_SLOT_HEIGHT_PX,
  CALENDAR_SLOT_MINUTES,
} from '@/lib/constants'
import { blockTotalMinutes } from '@/lib/calendar/eventDisplay'
import { coerceDurationMinutes, parseDbTimeToMinutes } from '@/lib/calendar/duration'
import { defaultDayBodyHeightPx, getEventHeightPx, getEventTopPx } from '@/lib/calendar/gridLayout'
import { assignOverlapLanes } from '@/lib/calendar/eventLayout'
import { WORKING_DAY_SLOT_COUNT, formatSlotLabel } from '@/lib/calendar/workingHours'
import { addDays, formatIsoDate, startOfWeekMonday, WEEKDAY_SHORT } from '@/lib/calendar/dates'
import type { CalendarViewMode } from '@/lib/calendar/viewMode'

export type { CalendarViewMode } from '@/lib/calendar/viewMode'

const START_MIN = CALENDAR_DAY_START_HOUR * 60
const END_MIN = CALENDAR_DAY_END_HOUR * 60

/** Fixed width so time labels stay one line (no “10:00” / “am” wrap). */
const TIME_GUTTER = '70px'

const SLOT_COUNT = WORKING_DAY_SLOT_COUNT
const DEFAULT_BODY_PX = defaultDayBodyHeightPx(SLOT_COUNT, CALENDAR_SLOT_HEIGHT_PX)

type Props = {
  mode: CalendarViewMode
  anchorDate: Date
  events: CalendarEventRow[]
  resolveName: (id: string) => string
  onSelectEvent: (ev: CalendarEventRow) => void
  bodyHeightPx?: number
}

function CurrentTimeLine({
  iso,
  slotHeightPx,
}: {
  iso: string
  slotHeightPx: number
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const todayIso = formatIsoDate(new Date())
  if (iso !== todayIso) return null

  const n = new Date()
  const nowMin = n.getHours() * 60 + n.getMinutes()
  if (nowMin < START_MIN || nowMin >= END_MIN) return null

  const top = getEventTopPx({
    startMinutesFromMidnight: nowMin,
    dayStartMinutes: START_MIN,
    slotMinutes: CALENDAR_SLOT_MINUTES,
    slotHeightPx,
  })

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-[35]"
      style={{ top: `${top}px` }}
      aria-hidden
    >
      <div className="relative h-0.5 w-full bg-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
    </div>
  )
}

export function CalendarGrid({
  mode,
  anchorDate,
  events,
  resolveName,
  onSelectEvent,
  bodyHeightPx = DEFAULT_BODY_PX,
}: Props) {
  const slotHeightPx = bodyHeightPx / SLOT_COUNT

  const days = useMemo(() => {
    if (mode === 'day') {
      return [new Date(anchorDate)]
    }
    const w0 = startOfWeekMonday(anchorDate)
    return Array.from({ length: 7 }, (_, i) => addDays(w0, i))
  }, [mode, anchorDate])

  const slotLabels = useMemo(() => {
    const labels: { key: string; topPct: number; text: string }[] = []
    for (let k = 0; k <= SLOT_COUNT; k++) {
      const mins = START_MIN + k * CALENDAR_SLOT_MINUTES
      labels.push({
        key: `slot-${k}`,
        topPct: (k / SLOT_COUNT) * 100,
        text: formatSlotLabel(mins),
      })
    }
    return labels
  }, [])

  const gridCols =
    mode === 'week' ? `${TIME_GUTTER} repeat(7,minmax(0,1fr))` : `${TIME_GUTTER} minmax(0,1fr)`

  return (
    <div className="flex min-h-[min(520px,70vh)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid shrink-0 border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: gridCols }}>
        <div className="p-2" />
        {days.map((d, i) => {
          const iso = formatIsoDate(d)
          const isToday = formatIsoDate(new Date()) === iso
          const label = mode === 'week' ? WEEKDAY_SHORT[i] : d.toLocaleDateString(undefined, { weekday: 'long' })
          return (
            <div key={iso} className="border-l border-gray-200 px-2 py-3 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
              <div
                className={`mt-1 text-lg font-bold tabular-nums ${
                  isToday
                    ? 'mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-2 ring-blue-600/20'
                    : 'text-gray-900'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* No inner vertical scrollbar — parent page scrolls */}
      <div className="overflow-hidden border-t border-gray-200 bg-white">
        <div
          className="grid"
          style={{
            gridTemplateColumns: gridCols,
            minHeight: bodyHeightPx + 48,
          }}
        >
          <div className="relative min-w-[70px] max-w-[70px] border-r border-gray-200 bg-gray-50 pr-2 text-right text-xs text-gray-500">
            {slotLabels.map(({ key, topPct, text }) => (
              <div
                key={key}
                className="absolute right-2 whitespace-nowrap font-medium tabular-nums leading-none text-gray-600"
                style={{
                  top: `${topPct}%`,
                  transform: topPct >= 99.5 ? 'translateY(-100%)' : 'translateY(-50%)',
                }}
              >
                {text}
              </div>
            ))}
          </div>

          {days.map(d => {
            const iso = formatIsoDate(d)
            const dayEvents = events.filter(e => e.date === iso)
            const fullDay = dayEvents.filter(e => e.is_full_day)
            const timed = dayEvents.filter(e => !e.is_full_day)

            const layoutInputs: Array<{ id: string; startMin: number; endMin: number }> = []
            for (const ev of timed) {
              const start = parseDbTimeToMinutes(ev.start_time)
              const dur = coerceDurationMinutes(ev.duration_minutes)
              if (start === null || dur <= 0) continue
              const totalBlock = blockTotalMinutes(ev)
              const rawEnd = start + totalBlock
              const end = Math.min(rawEnd, END_MIN)
              if (end <= START_MIN || start >= END_MIN) continue
              layoutInputs.push({ id: ev.id, startMin: start, endMin: end })
            }
            const lanes = assignOverlapLanes(layoutInputs)

            return (
              <div key={iso} className="relative min-w-0 border-l border-gray-100 bg-white">
                {fullDay.length > 0 && (
                  <div className="space-y-1 border-b border-gray-200 bg-gray-50/80 p-2">
                    {fullDay.map(ev => (
                      <EventCard
                        key={ev.id}
                        ev={ev}
                        assigneeName={resolveName(ev.assigned_to)}
                        compact
                        onClick={() => onSelectEvent(ev)}
                      />
                    ))}
                  </div>
                )}

                <div className="relative overflow-hidden rounded-b-lg border-t border-gray-100" style={{ height: bodyHeightPx }}>
                  {Array.from({ length: SLOT_COUNT }, (_, s) => (
                    <div
                      key={`band-${iso}-${s}`}
                      className={`pointer-events-none absolute left-0 right-0 border-t border-gray-100 ${
                        s % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                      }`}
                      style={{
                        top: `${(s / SLOT_COUNT) * 100}%`,
                        height: `${100 / SLOT_COUNT}%`,
                      }}
                    />
                  ))}

                  <CurrentTimeLine iso={iso} slotHeightPx={slotHeightPx} />

                  {timed.map(ev => {
                    const start = parseDbTimeToMinutes(ev.start_time)
                    const dur = coerceDurationMinutes(ev.duration_minutes)
                    if (start === null || dur <= 0) return null

                    const totalBlock = blockTotalMinutes(ev)
                    if (start >= END_MIN || start + totalBlock <= START_MIN) return null

                    const clipStart = Math.max(start, START_MIN)
                    const clipEnd = Math.min(start + totalBlock, END_MIN)
                    const effBlockMin = clipEnd - clipStart
                    if (effBlockMin <= 0) return null

                    const top = getEventTopPx({
                      startMinutesFromMidnight: clipStart,
                      dayStartMinutes: START_MIN,
                      slotMinutes: CALENDAR_SLOT_MINUTES,
                      slotHeightPx,
                    })
                    const height = getEventHeightPx(effBlockMin, CALENDAR_SLOT_MINUTES, slotHeightPx)

                    const lane = lanes.get(ev.id)
                    const laneCount = lane?.laneCount ?? 1
                    const laneIndex = lane?.lane ?? 0
                    const colPct = 100 / laneCount
                    const left = `${laneIndex * colPct}%`
                    const width = `${colPct}%`

                    return (
                      <div
                        key={ev.id}
                        className="absolute z-[1] box-border px-0.5 transition-all hover:z-[3]"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left,
                          width,
                        }}
                      >
                        <EventCard
                          ev={ev}
                          assigneeName={resolveName(ev.assigned_to)}
                          compact
                          fillGrid
                          onClick={() => onSelectEvent(ev)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-[11px] text-gray-500">
        Working hours {CALENDAR_DAY_START_HOUR}:00–{CALENDAR_DAY_END_HOUR}:00 · blocks use work + travel ·{' '}
        {CALENDAR_SLOT_MINUTES} min slots
      </div>
    </div>
  )
}
