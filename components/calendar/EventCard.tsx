'use client'

import type { CalendarEventRow, EventType } from '@/lib/calendar/types'
import {
  blockTotalMinutes,
  calendarEventDisplayLocation,
  formatEventTimeRange,
  splitRoundTripLegs,
} from '@/lib/calendar/eventDisplay'
import { coerceDurationMinutes } from '@/lib/calendar/duration'

/** Inline SVGs avoid Turbopack/HMR issues with lucide per-icon chunks in this hot path. */
function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" />
      <circle cx="12" cy="8" r="3.5" />
    </svg>
  )
}

/** Teams-style vertical accent (left rail). */
const TYPE_BAR: Record<EventType, string> = {
  task: 'bg-sky-500',
  block: 'bg-gray-400',
  leave: 'bg-rose-500',
  meeting: 'bg-violet-600',
}

type Props = {
  ev: CalendarEventRow
  assigneeName: string
  compact?: boolean
  fillGrid?: boolean
  onClick?: () => void
}

export function EventCard({ ev, assigneeName, compact, fillGrid, onClick }: Props) {
  const barClass = TYPE_BAR[ev.event_type] ?? TYPE_BAR.task
  const displayLocation = calendarEventDisplayLocation(ev)
  const timeRange = formatEventTimeRange(ev)
  const workMin = coerceDurationMinutes(ev.duration_minutes)
  const travelMin = Math.max(0, Math.round(ev.travel_minutes))
  const travelLegs = travelMin > 0 ? splitRoundTripLegs(travelMin) : null
  const totalMin = blockTotalMinutes(ev)

  const teamsGrid = Boolean(compact && fillGrid && !ev.is_full_day)

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`group relative box-border w-full rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-all hover:z-[2] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
        teamsGrid
          ? 'h-full min-h-0 flex flex-col overflow-hidden px-2 py-1'
          : fillGrid
            ? 'h-full min-h-0 flex flex-col overflow-hidden py-1 pl-3 pr-1.5'
            : compact
              ? 'px-2 py-1.5 pl-3'
              : 'px-3 py-2.5 pl-4'
      }`}
    >
      <span
        className={`absolute bottom-0 left-0 top-0 w-1 rounded-l-xl ${barClass}`}
        aria-hidden
      />

      <p
        className={`relative shrink-0 truncate font-semibold leading-tight text-gray-900 ${
          teamsGrid ? 'text-xs' : compact ? 'text-[10px] line-clamp-2' : 'text-sm line-clamp-2'
        }`}
      >
        {ev.title}
      </p>

      {teamsGrid && (
        <div className="relative mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden text-left">
          {timeRange && (
            <p className="truncate text-[11px] leading-tight text-gray-500 whitespace-nowrap">{timeRange}</p>
          )}
          {displayLocation && (
            <p className="line-clamp-1 text-[11px] leading-tight text-gray-500" title={displayLocation}>
              <span className="mr-0.5" aria-hidden>
                📍
              </span>
              {displayLocation}
            </p>
          )}
          <div className="my-0.5 shrink-0 border-t border-gray-100" role="presentation" />
          <p className="text-[11px] font-medium leading-tight text-blue-600">
            <span className="mr-0.5" aria-hidden>
              ⚒
            </span>
            Work: {workMin} min
          </p>
          {travelMin > 0 && travelLegs && (
            <>
              <p className="text-[11px] font-medium leading-tight text-orange-600">
                <span className="mr-0.5" aria-hidden>
                  🚗
                </span>
                Travel: {travelMin} min
              </p>
              <p className="text-[10px] leading-tight text-gray-500">
                → To site: {travelLegs.toSite} min · ← Return: {travelLegs.returnLeg} min
              </p>
            </>
          )}
          <p className="mt-auto text-[11px] font-semibold leading-tight text-gray-700">Total: {totalMin} min</p>
          <p className="truncate text-[8px] leading-tight text-gray-400">{assigneeName}</p>
        </div>
      )}

      {!teamsGrid && !compact && (
        <div className="relative mt-1.5 flex flex-col gap-1 text-[11px] text-gray-600">
          {ev.is_full_day ? (
            <span className="inline-flex items-center gap-1 font-medium text-gray-800">
              <IconClock className="h-3 w-3 shrink-0 text-gray-500" aria-hidden />
              Full day
            </span>
          ) : (
            <>
              {timeRange && (
                <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-gray-500">
                  <IconClock className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                  {timeRange}
                </span>
              )}
              <span className="font-medium text-blue-600">
                <span className="mr-1" aria-hidden>
                  ⚒
                </span>
                Work: {workMin} min
              </span>
              {travelMin > 0 && travelLegs && (
                <>
                  <span className="font-medium text-orange-600">
                    <span className="mr-1" aria-hidden>
                      🚗
                    </span>
                    Travel: {travelMin} min
                  </span>
                  <span className="text-[10px] text-gray-500">
                    → To site: {travelLegs.toSite} min · ← Return: {travelLegs.returnLeg} min
                  </span>
                </>
              )}
              <span className="font-semibold text-gray-700">Total: {totalMin} min</span>
            </>
          )}
          {displayLocation && (
            <span className="inline-flex items-start gap-1 line-clamp-2 text-gray-500">
              <IconMapPin className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              {displayLocation}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-gray-500">
            <IconUser className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
            {assigneeName}
          </span>
        </div>
      )}

      {!teamsGrid && compact && (
        <div className="relative mt-0.5 min-h-0 flex-1 space-y-0.5 overflow-hidden text-[9px] leading-tight text-gray-600">
          {!ev.is_full_day && timeRange && (
            <p className="truncate font-medium whitespace-nowrap text-gray-900">{timeRange}</p>
          )}
          {!ev.is_full_day && (
            <p className="truncate text-gray-500">
              {workMin} min{travelMin > 0 ? ` + ${travelMin} travel (rt)` : ''}
            </p>
          )}
          {displayLocation && <p className="line-clamp-1 text-gray-500">{displayLocation}</p>}
          <p className="truncate text-[8px] text-gray-400">{assigneeName}</p>
        </div>
      )}
    </button>
  )
}
