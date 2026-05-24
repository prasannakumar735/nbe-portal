'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CalendarEventRow, EventType } from '@/lib/calendar/types'
import {
  calendarEventIsMultiDayTask,
  calendarEventTouchesDay,
  multiDayWeekSpanPlacements,
  assignWeekSpanRows,
} from '@/lib/calendar/multiDay'
import { EventCard } from '@/components/calendar/EventCard'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  CALENDAR_SLOT_HEIGHT_PX,
  CALENDAR_SLOT_MINUTES,
} from '@/lib/constants'
import { blockTotalMinutes, calendarEventDisplayLocation, formatCalendarMultiDayOrFullDay } from '@/lib/calendar/eventDisplay'
import { coerceDurationMinutes, parseDbTimeToMinutes } from '@/lib/calendar/duration'
import { defaultDayBodyHeightPx, getEventHeightPx, getEventTopPx } from '@/lib/calendar/gridLayout'
import { assignOverlapLanes } from '@/lib/calendar/eventLayout'
import { WORKING_DAY_SLOT_COUNT, formatSlotLabel } from '@/lib/calendar/workingHours'
import { calendarEventAssigneeLabels, calendarEventAssigneeIds } from '@/lib/calendar/assignees'
import { addDays, formatIsoDate, getMonthCalendarGridDates, startOfWeekMonday, WEEKDAY_SHORT } from '@/lib/calendar/dates'
import type { CalendarViewMode } from '@/lib/calendar/viewMode'

export type { CalendarViewMode } from '@/lib/calendar/viewMode'

const MONTH_CELL_MAX_EVENTS = 3

function sortDayEventsForMonthGrid(evs: CalendarEventRow[]): CalendarEventRow[] {
  return [...evs].sort((a, b) => {
    if (a.is_full_day && !b.is_full_day) return -1
    if (!a.is_full_day && b.is_full_day) return 1
    const am = parseDbTimeToMinutes(a.start_time) ?? 0
    const bm = parseDbTimeToMinutes(b.start_time) ?? 0
    return am - bm
  })
}

function MonthCalendarGrid({
  anchorDate,
  events,
  resolveName,
  onSelectEvent,
  onOpenDayInDayView,
}: {
  anchorDate: Date
  events: CalendarEventRow[]
  resolveName: (id: string) => string
  onSelectEvent: (ev: CalendarEventRow) => void
  onOpenDayInDayView?: (dateIso: string) => void
}) {
  const todayIso = formatIsoDate(new Date())
  const gridDays = useMemo(() => getMonthCalendarGridDates(anchorDate), [anchorDate])
  const monthTitle = anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="flex min-h-[min(520px,70vh)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-center sm:text-left">
        <p className="text-sm font-semibold text-gray-900">{monthTitle}</p>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {WEEKDAY_SHORT.map(d => (
          <div
            key={d}
            className="border-l border-gray-200 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 first:border-l-0 md:px-2 md:text-[11px]"
          >
            {d.slice(0, 3)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr bg-white md:min-h-[420px]">
        {gridDays.map(cellDate => {
          const iso = formatIsoDate(cellDate)
          const y = anchorDate.getFullYear()
          const m = anchorDate.getMonth()
          const inAnchorMonth = cellDate.getFullYear() === y && cellDate.getMonth() === m
          const isToday = iso === todayIso
          const sorted = sortDayEventsForMonthGrid(events.filter(ev => calendarEventTouchesDay(ev, iso)))
          const visible = sorted.slice(0, MONTH_CELL_MAX_EVENTS)
          const extra = sorted.length - visible.length

          const dayNum = (
            <span
              className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full text-[11px] font-bold tabular-nums md:h-7 md:text-sm ${
                isToday ? 'bg-blue-600 text-white' : !inAnchorMonth ? 'text-gray-400' : 'text-gray-800'
              }`}
            >
              {cellDate.getDate()}
            </span>
          )

          return (
            <div
              key={iso}
              className={`min-h-[108px] border-b border-r border-gray-100 p-1 md:min-h-[120px] ${
                !inAnchorMonth ? 'bg-gray-50/50' : 'bg-white'
              }`}
            >
              <div className="mb-1 flex justify-end">
                {onOpenDayInDayView ? (
                  <button
                    type="button"
                    onClick={() => onOpenDayInDayView(iso)}
                    className="rounded-full transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    aria-label={`Open day view for ${iso}`}
                  >
                    {dayNum}
                  </button>
                ) : (
                  dayNum
                )}
              </div>
              <div className="space-y-0.5">
                {visible.map(ev => (
                  <EventCard
                    key={`${ev.id}-${iso}`}
                    ev={ev}
                    calendarDayIso={iso}
                    assigneeLabels={calendarEventAssigneeLabels(ev, resolveName)}
                    monthChip
                    onClick={() => onSelectEvent(ev)}
                  />
                ))}
                {extra > 0 && (
                  <>
                    {onOpenDayInDayView ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onOpenDayInDayView(iso)
                        }}
                        className="w-full rounded px-1 py-0.5 text-left text-[10px] font-semibold text-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
                      >
                        +{extra} more
                      </button>
                    ) : (
                      <p className="px-1 py-0.5 text-[10px] font-medium text-gray-500">+{extra} more</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-[11px] text-gray-500">
        Month overview · select a date number or “+more” to open the timed day grid · events reflect work + factory
        round-trip travel
      </div>
    </div>
  )
}

const START_MIN = CALENDAR_DAY_START_HOUR * 60
const END_MIN = CALENDAR_DAY_END_HOUR * 60

/** Fixed width so time labels stay one line (no “10:00” / “am” wrap). */
const DEFAULT_TIME_GUTTER = '70px'

const SLOT_COUNT = WORKING_DAY_SLOT_COUNT
const DEFAULT_BODY_PX = defaultDayBodyHeightPx(SLOT_COUNT, CALENDAR_SLOT_HEIGHT_PX)

const WEEK_ALLDAY_ROWS_MAX = 3
const WEEK_ALLDAY_BAR_H = 26
const WEEK_ALLDAY_BAR_GAP = 4
const WEEK_ALLDAY_STRIP_PAD_TOP = 8
const WEEK_ALLDAY_STRIP_PAD_BOTTOM = 6
const WEEK_ALLDAY_OVERFLOW_NOTE_H = 22

const TYPE_BORDER_LEFT: Record<EventType, string> = {
  task: 'border-l-sky-500',
  block: 'border-l-gray-400',
  leave: 'border-l-rose-500',
  meeting: 'border-l-violet-600',
}

const ASSIGNEE_BADGE_STYLES = [
  'bg-sky-600 text-white',
  'bg-violet-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-500 text-white',
  'bg-rose-600 text-white',
  'bg-indigo-600 text-white',
  'bg-cyan-600 text-white',
  'bg-fuchsia-600 text-white',
] as const

function weekAllDayAssigneeBadgeStyle(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return ASSIGNEE_BADGE_STYLES[hash % ASSIGNEE_BADGE_STYLES.length]
}

function weekAllDayAssigneeInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

type Props = {
  mode: CalendarViewMode
  anchorDate: Date
  events: CalendarEventRow[]
  resolveName: (id: string) => string
  onSelectEvent: (ev: CalendarEventRow) => void
  /** Month view: navigate to timed day grid for a date */
  onOpenDayInDayView?: (dateIso: string) => void
  bodyHeightPx?: number
  /** Override the left time-label column width (e.g. '52px' on mobile). */
  timeGutterWidth?: string
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
  onOpenDayInDayView,
  bodyHeightPx = DEFAULT_BODY_PX,
  timeGutterWidth = DEFAULT_TIME_GUTTER,
}: Props) {
  if (mode === 'month') {
    return (
      <MonthCalendarGrid
        anchorDate={anchorDate}
        events={events}
        resolveName={resolveName}
        onSelectEvent={onSelectEvent}
        onOpenDayInDayView={onOpenDayInDayView}
      />
    )
  }

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
    mode === 'week' ? `${timeGutterWidth} repeat(7,minmax(0,1fr))` : `${timeGutterWidth} minmax(0,1fr)`

  const weekMonday = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate])

  const multiDayWeekPlacementsRaw = useMemo(() => {
    if (mode !== 'week') return []
    return multiDayWeekSpanPlacements(events, weekMonday)
  }, [mode, events, weekMonday])

  const multiDayWeekPlaced = useMemo(() => assignWeekSpanRows(multiDayWeekPlacementsRaw, WEEK_ALLDAY_ROWS_MAX), [multiDayWeekPlacementsRaw])

  const weekStripHeightPx = useMemo(() => {
    if (mode !== 'week' || multiDayWeekPlacementsRaw.length === 0) return 0
    let h = WEEK_ALLDAY_STRIP_PAD_TOP + WEEK_ALLDAY_STRIP_PAD_BOTTOM
    const placed = multiDayWeekPlaced.placed
    const lanesUsed =
      placed.length === 0
        ? 0
        : Math.min(WEEK_ALLDAY_ROWS_MAX, Math.max(...placed.map(p => p.row)) + 1)
    h += lanesUsed * WEEK_ALLDAY_BAR_H + Math.max(0, lanesUsed - 1) * WEEK_ALLDAY_BAR_GAP
    if (multiDayWeekPlaced.overflow.length > 0) {
      h += WEEK_ALLDAY_OVERFLOW_NOTE_H
    }
    return h
  }, [mode, multiDayWeekPlacementsRaw.length, multiDayWeekPlaced])

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

      {mode === 'week' && multiDayWeekPlacementsRaw.length > 0 && (
        <div className="grid shrink-0 border-b border-gray-200 bg-gray-50/85" style={{ gridTemplateColumns: gridCols }}>
          <div className="relative shrink-0 border-r border-gray-200 bg-gray-50 px-1 py-1 text-right md:py-2">
            <span className="hidden text-[9px] font-semibold uppercase leading-tight tracking-wide text-gray-400 md:inline-block">
              All day
            </span>
          </div>
          <div
            className="relative min-h-0 min-w-0 border-l border-gray-100 px-2"
            style={{ gridColumn: '2 / span 7', minHeight: Math.max(weekStripHeightPx, 1) }}
          >
            {multiDayWeekPlaced.placed.map(p => {
              const ev = p.ev
              const labels = calendarEventAssigneeLabels(ev, resolveName)
              const ids = calendarEventAssigneeIds(ev)
              const name = labels.join(', ')
              const primaryId = ids[0] ?? ev.assigned_to
              const leftPct = (p.startCol / 7) * 100
              const spanDays = p.endCol - p.startCol + 1
              const widthPct = (spanDays / 7) * 100
              const topPx = WEEK_ALLDAY_STRIP_PAD_TOP + p.row * (WEEK_ALLDAY_BAR_H + WEEK_ALLDAY_BAR_GAP)
              const bLeft = TYPE_BORDER_LEFT[ev.event_type] ?? TYPE_BORDER_LEFT.task
              const loc = calendarEventDisplayLocation(ev)
              const dt = formatCalendarMultiDayOrFullDay(ev)
              const label = `${ev.title}. ${dt}. Assigned to ${name}.${loc ? ` ${loc}` : ''}`
              const initialsSource = labels[0] ?? name ?? '?'
              const initials = weekAllDayAssigneeInitials(initialsSource)
              const badge = weekAllDayAssigneeBadgeStyle(primaryId)

              const tt = (
                <div className="max-w-xs space-y-1 text-left text-xs">
                  <p className="font-semibold text-gray-900">{ev.title}</p>
                  <p className="text-gray-600">{dt}</p>
                  {loc ? <p className="text-gray-500">{loc}</p> : null}
                  <p className="text-[11px] text-gray-600">Assigned to {name}</p>
                </div>
              )

              return (
                <Tooltip key={`${ev.id}-week-span-${p.row}-${p.startCol}-${p.endCol}`} content={tt} className="contents">
                  <button
                    type="button"
                    aria-label={label}
                    className={`box-border flex items-center gap-1.5 rounded-md border border-gray-200 bg-white py-0.5 pl-1 pr-9 text-left shadow-sm transition hover:z-[25] hover:shadow-md focus-visible:z-[25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:rounded-lg border-l-[3px] ${bLeft}`}
                    style={{
                      position: 'absolute',
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      top: topPx,
                      height: WEEK_ALLDAY_BAR_H,
                      zIndex: 20 + p.row,
                    }}
                    onClick={e => {
                      e.stopPropagation()
                      onSelectEvent(ev)
                    }}
                  >
                    <span
                      className={`ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none md:h-6 md:w-6 md:text-[10px] ${badge}`}
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-900 md:text-xs">{ev.title}</span>
                  </button>
                </Tooltip>
              )
            })}
            {multiDayWeekPlaced.overflow.length > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-2 text-center"
                role="note"
              >
                <span className="rounded bg-gray-100/90 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  +{multiDayWeekPlaced.overflow.length} more overlapping
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No inner vertical scrollbar — parent page scrolls */}
      <div className="overflow-hidden border-t border-gray-200 bg-white">
        <div
          className="grid"
          style={{
            gridTemplateColumns: gridCols,
            minHeight: bodyHeightPx + 48 + weekStripHeightPx,
          }}
        >
          <div className="relative border-r border-gray-200 bg-gray-50 pr-2 text-right text-xs text-gray-500" style={{ minWidth: timeGutterWidth, maxWidth: timeGutterWidth }}>
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
            const dayEvents = events.filter(e => calendarEventTouchesDay(e, iso))
            const fullDay = dayEvents.filter(
              e =>
                e.is_full_day &&
                !(mode === 'week' && calendarEventIsMultiDayTask(e)),
            )
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
                        key={`${ev.id}-${iso}`}
                        ev={ev}
                        calendarDayIso={iso}
                        assigneeLabels={calendarEventAssigneeLabels(ev, resolveName)}
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
                        key={`${ev.id}-${iso}`}
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
                          calendarDayIso={iso}
                          assigneeLabels={calendarEventAssigneeLabels(ev, resolveName)}
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
