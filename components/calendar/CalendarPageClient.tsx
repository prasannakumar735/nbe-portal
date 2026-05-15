'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarPlus, Loader2 } from 'lucide-react'
import { CalendarGrid, type CalendarViewMode } from '@/components/calendar/CalendarGrid'
import { EventCard } from '@/components/calendar/EventCard'
import { EventModal } from '@/components/calendar/EventModal'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import type { CalendarEventRow } from '@/lib/calendar/types'
import { addDays, formatIsoDate, startOfWeekMonday, WEEKDAY_SHORT } from '@/lib/calendar/dates'
import { BASE_LOCATION } from '@/lib/constants'
import { parseDbTimeToMinutes } from '@/lib/calendar/duration'

/** Single-letter day labels for the compact mobile strip. */
const WEEKDAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

type Props = {
  userId: string
  canManage: boolean
}

/** Sort events within a day: full-day first, then by start_time ascending. */
function sortDayEvents(evs: CalendarEventRow[]): CalendarEventRow[] {
  return [...evs].sort((a, b) => {
    if (a.is_full_day && !b.is_full_day) return -1
    if (!a.is_full_day && b.is_full_day) return 1
    const am = parseDbTimeToMinutes(a.start_time) ?? 0
    const bm = parseDbTimeToMinutes(b.start_time) ?? 0
    return am - bm
  })
}

export function CalendarPageClient({ userId, canManage }: Props) {
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Desktop view mode
  const [view, setView] = useState<CalendarViewMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'day'
    return 'week'
  })

  // Mobile-only: 'day' (time grid) or 'week' (vertical agenda)
  const [mobileView, setMobileView] = useState<'day' | 'week'>('day')

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [modalEvent, setModalEvent] = useState<CalendarEventRow | null>(null)

  // Keep view + isMobile in sync with viewport
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) { setView('week'); setIsMobile(false) }
      else { setView('day'); setIsMobile(true) }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const {
    events,
    assignees,
    resolveName,
    loading,
    error,
    fetchRange,
    insertEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarEvents({ userId, canManage })

  // Always fetch the full week on mobile (for strip dots + agenda).
  // Desktop day-view fetches only that day.
  const range = useMemo(() => {
    const ws = startOfWeekMonday(anchorDate)
    const we = addDays(ws, 6)
    if (view === 'week' || isMobile) {
      return { from: formatIsoDate(ws), to: formatIsoDate(we) }
    }
    const d = formatIsoDate(anchorDate)
    return { from: d, to: d }
  }, [anchorDate, view, isMobile])

  useEffect(() => {
    void fetchRange(range.from, range.to)
  }, [range.from, range.to, fetchRange])

  // Week strip days
  const stripDays = useMemo(() => {
    const ws = startOfWeekMonday(anchorDate)
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  }, [anchorDate])

  const todayIso = formatIsoDate(new Date())
  const anchorIso = formatIsoDate(anchorDate)

  // Event dot map for the strip
  const eventDaySet = useMemo(() => {
    const s = new Set<string>()
    for (const ev of events) s.add(ev.date)
    return s
  }, [events])

  // Desktop range label
  const rangeLabel = useMemo(() => {
    if (view === 'week') {
      const ws = startOfWeekMonday(anchorDate)
      const we = addDays(ws, 6)
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
      return `${ws.toLocaleDateString(undefined, opts)} – ${we.toLocaleDateString(undefined, opts)}`
    }
    return anchorDate.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  }, [anchorDate, view])

  // Mobile day heading (day view only)
  const mobileDayLabel = useMemo(
    () => anchorDate.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }),
    [anchorDate]
  )

  // Mobile week label (week view header)
  const mobileWeekLabel = useMemo(() => {
    const ws = startOfWeekMonday(anchorDate)
    const we = addDays(ws, 6)
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${ws.toLocaleDateString(undefined, opts)} – ${we.toLocaleDateString(undefined, opts)}`
  }, [anchorDate])

  const goToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setAnchorDate(d)
  }

  const goPrev = () => {
    if (view === 'week') setAnchorDate(d => addDays(d, -7))
    else setAnchorDate(d => addDays(d, -1))
  }

  const goNext = () => {
    if (view === 'week') setAnchorDate(d => addDays(d, 7))
    else setAnchorDate(d => addDays(d, 1))
  }

  const goStripPrevWeek = () => setAnchorDate(d => addDays(d, -7))
  const goStripNextWeek = () => setAnchorDate(d => addDays(d, 7))

  const openCreate = () => {
    setModalEvent(null)
    setModalOpen(true)
  }

  const openEvent = (ev: CalendarEventRow) => {
    setModalEvent(ev)
    setModalOpen(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 md:px-6 md:py-4">
        <h1 className="text-lg font-semibold text-gray-900 md:text-xl">Shared calendar</h1>
        {/* All users can create events */}
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:gap-2 md:px-4"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">New event</span>
          <span className="sm:hidden">New</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">

        {/* ── Desktop: description + controls ─────────────────────────── */}
        <div className="hidden md:block">
          <div className="px-6 pt-6">
            <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
              Field schedule from {BASE_LOCATION.label}. Travel times are round trip (factory → job → factory).
            </p>
          </div>

          <div className="mx-6 mt-4 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('week')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setView('day')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Day
                </button>
              </div>
              <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />
              <div className="flex items-center gap-1">
                <button type="button" onClick={goPrev} className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100" aria-label="Previous">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={goNext} className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100" aria-label="Next">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button type="button" onClick={goToday} className="ml-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Today
                </button>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 sm:text-right">{rangeLabel}</p>
          </div>
        </div>

        {/* ── Mobile: Teams-style week strip ───────────────────────────── */}
        {isMobile && (
          <div className="sticky top-[57px] z-10 shrink-0 border-b border-gray-100 bg-white shadow-sm">

            {/* Week navigation row */}
            <div className="flex items-center px-1 pt-2">
              <button
                type="button"
                onClick={goStripPrevWeek}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* 7-day strip */}
              <div className="grid flex-1 grid-cols-7">
                {stripDays.map((d, i) => {
                  const iso = formatIsoDate(d)
                  const isToday = iso === todayIso
                  const isSelected = iso === anchorIso && mobileView === 'day'
                  const hasEvents = eventDaySet.has(iso)
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        const next = new Date(d)
                        next.setHours(0, 0, 0, 0)
                        setAnchorDate(next)
                        setMobileView('day')
                      }}
                      className="flex flex-col items-center gap-0.5 py-1.5 transition"
                      aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      aria-pressed={isSelected}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {WEEKDAY_LETTER[i]}
                      </span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums transition ${
                        isSelected && isToday ? 'bg-blue-600 text-white'
                        : isSelected ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                        : isToday ? 'text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}>
                        {d.getDate()}
                      </span>
                      <span className={`h-1 w-1 rounded-full transition ${
                        hasEvents ? (isSelected ? 'bg-blue-400' : 'bg-gray-400') : 'bg-transparent'
                      }`} aria-hidden />
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={goStripNextWeek}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                aria-label="Next week"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day / Week toggle + label row */}
            <div className="flex items-center justify-between px-3 pb-2 pt-1">
              {/* View toggle */}
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setMobileView('day')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    mobileView === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView('week')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    mobileView === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Week
                </button>
              </div>

              {/* Label + Today */}
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-semibold text-gray-700">
                  {mobileView === 'week' ? mobileWeekLabel : mobileDayLabel}
                </p>
                {anchorIso !== todayIso && (
                  <button
                    type="button"
                    onClick={goToday}
                    className="rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 md:mx-6">
            {error}
          </div>
        )}

        {/* ── Calendar body ────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
            <p className="text-sm font-medium text-gray-700">Loading schedule…</p>
          </div>
        ) : isMobile && mobileView === 'week' ? (

          /* ── Mobile: vertical week agenda ───────────────────────────── */
          <div className="flex-1 overflow-y-auto">
            {stripDays.map((d, i) => {
              const iso = formatIsoDate(d)
              const isToday = iso === todayIso
              const dayEvents = sortDayEvents(events.filter(ev => ev.date === iso))
              return (
                <div key={iso}>
                  {/* Day header */}
                  <div className={`sticky top-0 z-[5] flex items-center gap-2 border-b border-gray-100 px-4 py-2 ${
                    isToday ? 'bg-blue-50' : 'bg-gray-50'
                  }`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                    }`}>
                      {d.getDate()}
                    </span>
                    <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                      {WEEKDAY_SHORT[i]}
                      {isToday && <span className="ml-1.5 text-xs font-normal text-blue-500">Today</span>}
                    </span>
                  </div>

                  {/* Events or empty */}
                  {dayEvents.length === 0 ? (
                    <p className="px-4 py-3 text-xs italic text-gray-400">No events scheduled</p>
                  ) : (
                    <div className="space-y-2 px-3 py-2">
                      {dayEvents.map(ev => (
                        <EventCard
                          key={ev.id}
                          ev={ev}
                          assigneeName={resolveName(ev.assigned_to)}
                          onClick={() => openEvent(ev)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        ) : (

          /* ── Day grid (mobile) or Week/Day grid (desktop) ─────────── */
          <div className={`flex-1 overflow-y-auto ${
            view === 'week' && !isMobile
              ? 'overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]'
              : 'overflow-x-hidden'
          }`}>
            <div className={`${
              view === 'week' && !isMobile ? 'min-w-[900px] md:min-w-full' : 'min-w-full'
            } ${isMobile ? '' : 'px-6 py-4'}`}>
              <CalendarGrid
                mode={isMobile ? 'day' : view}
                anchorDate={anchorDate}
                events={events}
                resolveName={resolveName}
                onSelectEvent={openEvent}
                timeGutterWidth={isMobile ? '52px' : '70px'}
              />
            </div>
          </div>
        )}
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setModalEvent(null)
        }}
        canManage={canManage}
        currentUserId={userId}
        assignees={assignees}
        allEvents={events}
        initial={modalEvent}
        defaultDate={formatIsoDate(anchorDate)}
        onCreate={async p => { await insertEvent(p) }}
        onUpdate={async (id, p) => { await updateEvent(id, p) }}
        onDelete={canManage ? deleteEvent : undefined}
      />
    </div>
  )
}
