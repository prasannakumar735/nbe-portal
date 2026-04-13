'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarPlus, Loader2 } from 'lucide-react'
import { CalendarGrid, type CalendarViewMode } from '@/components/calendar/CalendarGrid'
import { EventModal } from '@/components/calendar/EventModal'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import type { CalendarEventRow } from '@/lib/calendar/types'
import { addDays, formatIsoDate, startOfWeekMonday } from '@/lib/calendar/dates'
import { BASE_LOCATION } from '@/lib/constants'

type Props = {
  userId: string
  canManage: boolean
}

export function CalendarPageClient({ userId, canManage }: Props) {
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [view, setView] = useState<CalendarViewMode>('week')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalEvent, setModalEvent] = useState<CalendarEventRow | null>(null)

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

  const range = useMemo(() => {
    if (view === 'week') {
      const ws = startOfWeekMonday(anchorDate)
      const we = addDays(ws, 6)
      return { from: formatIsoDate(ws), to: formatIsoDate(we) }
    }
    const d = formatIsoDate(anchorDate)
    return { from: d, to: d }
  }, [anchorDate, view])

  useEffect(() => {
    void fetchRange(range.from, range.to)
  }, [range.from, range.to, fetchRange])

  const rangeLabel = useMemo(() => {
    if (view === 'week') {
      const ws = startOfWeekMonday(anchorDate)
      const we = addDays(ws, 6)
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
      return `${ws.toLocaleDateString(undefined, opts)} – ${we.toLocaleDateString(undefined, opts)}`
    }
    return anchorDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }, [anchorDate, view])

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

  const openCreate = () => {
    setModalEvent(null)
    setModalOpen(true)
  }

  const openEvent = (ev: CalendarEventRow) => {
    setModalEvent(ev)
    setModalOpen(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <header className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <h1 className="text-xl font-semibold text-gray-900">Shared calendar</h1>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:w-auto"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            New event
          </button>
        )}
      </header>

      <div className="flex flex-col gap-6 px-4 py-6 md:px-6">
        <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
          Field schedule from {BASE_LOCATION.label}. Travel times are round trip (factory → job → factory).
        </p>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex flex-1 flex-wrap items-center gap-1 sm:flex-initial">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="ml-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Today
              </button>
            </div>
          </div>
          <p className="text-center text-sm font-semibold text-gray-900 sm:text-right">{rangeLabel}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-24 text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
            <p className="text-sm font-medium text-gray-700">Loading schedule…</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
            <div className="min-w-[900px] md:min-w-full">
              <CalendarGrid
                mode={view}
                anchorDate={anchorDate}
                events={events}
                resolveName={resolveName}
                onSelectEvent={openEvent}
              />
            </div>
          </div>
        )}

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
          onCreate={async p => {
            await insertEvent(p)
          }}
          onUpdate={async (id, p) => {
            await updateEvent(id, p)
          }}
          onDelete={canManage ? deleteEvent : undefined}
        />
      </div>
    </div>
  )
}
