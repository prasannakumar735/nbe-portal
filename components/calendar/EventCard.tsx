'use client'

import type { CalendarEventRow, EventType } from '@/lib/calendar/types'
import { calendarEventAssigneeIds } from '@/lib/calendar/assignees'
import {
  blockTotalMinutes,
  calendarEventDisplayLocation,
  formatEventTimeRange,
  splitRoundTripLegs,
} from '@/lib/calendar/eventDisplay'
import {
  calendarEventIsMultiDayTask,
  calendarTaskSpanSegment,
  type TaskSpanSegment,
} from '@/lib/calendar/multiDay'
import { coerceDurationMinutes } from '@/lib/calendar/duration'
import { Tooltip } from '@/components/ui/Tooltip'

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

const TYPE_BORDER: Record<EventType, string> = {
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

function getAssigneeBadgeStyle(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return ASSIGNEE_BADGE_STYLES[hash % ASSIGNEE_BADGE_STYLES.length]
}

function getAssigneeInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

function eventTypeLabel(t: EventType): string {
  switch (t) {
    case 'task':
      return 'Task'
    case 'block':
      return 'Block'
    case 'leave':
      return 'Leave'
    case 'meeting':
      return 'Meeting'
    default:
      return t
  }
}

function RichTooltipInner({
  ev,
  assigneeSummary,
  displayLocation,
  timeRange,
  workMin,
  travelMin,
  travelLegs,
  totalMin,
}: {
  ev: CalendarEventRow
  assigneeSummary: string
  displayLocation: string | null
  timeRange: string
  workMin: number
  travelMin: number
  travelLegs: { toSite: number; returnLeg: number } | null
  totalMin: number
}) {
  const b = TYPE_BORDER[ev.event_type] ?? TYPE_BORDER.task
  const notes = (ev.description ?? '').trim()

  return (
    <div className={`space-y-1.5 border-l-[3px] border-solid ${b} pl-2`}>
      <p className="font-semibold text-gray-900">{ev.title}</p>
      <p className="text-[11px] text-gray-500">
        <span className="font-medium text-gray-700">{eventTypeLabel(ev.event_type)}</span>
        {' · '}
        <span className="capitalize">{ev.status.replace(/_/g, ' ')}</span>
      </p>
      {timeRange ? (
        <p className="flex items-center gap-1 text-gray-700">
          <IconClock className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
          {timeRange}
        </p>
      ) : null}

      {!ev.is_full_day && (
        <>
          <p className="text-[11px] font-medium text-blue-700">
            Work on site: <span className="tabular-nums">{workMin}</span> min
          </p>
          {travelMin > 0 && travelLegs ? (
            <div className="text-[11px] text-orange-700">
              <p className="font-medium">
                Travel (return trip): <span className="tabular-nums">{travelMin}</span> min
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-gray-600">
                To site <span className="tabular-nums">{travelLegs.toSite}</span> min · Return{' '}
                <span className="tabular-nums">{travelLegs.returnLeg}</span> min
              </p>
            </div>
          ) : null}
          <p className="text-[11px] font-semibold text-gray-900">
            Total calendar block: <span className="tabular-nums">{totalMin}</span> min
          </p>
        </>
      )}

      {displayLocation ? (
        <p className="flex items-start gap-1 text-gray-600">
          <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
          <span className="leading-snug">{displayLocation}</span>
        </p>
      ) : null}

      <p className="flex items-center gap-1 border-t border-gray-100 pt-1.5 text-gray-700">
        <IconUser className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
        <span>{assigneeSummary || 'Assigned to unknown'}</span>
      </p>

      {notes ? (
        <p className="border-t border-gray-100 pt-1.5 text-[11px] leading-snug text-gray-600">
          {notes}
        </p>
      ) : null}
    </div>
  )
}

function CondensedTooltipInner({
  ev,
  assigneeSummary,
  displayLocation,
  timeRange,
}: {
  ev: CalendarEventRow
  assigneeSummary: string
  displayLocation: string | null
  timeRange: string
}) {
  const b = TYPE_BORDER[ev.event_type] ?? TYPE_BORDER.task
  return (
    <div className={`space-y-1 border-l-[3px] border-solid ${b} pl-2`}>
      <p className="font-semibold text-gray-900">{ev.title}</p>
      <p className="text-[11px] text-gray-500">{eventTypeLabel(ev.event_type)}</p>
      {timeRange ? <p className="text-gray-700">{timeRange}</p> : null}
      {displayLocation ? <p className="text-[11px] text-gray-600">{displayLocation}</p> : null}
      <p className="text-[11px] text-gray-800">{assigneeSummary || 'Assigned to unknown'}</p>
    </div>
  )
}

function spanAccentClass(seg: TaskSpanSegment | null, monthChip: boolean | undefined): string {
  if (!seg || seg === 'single') return ''
  const dense = Boolean(monthChip)
  const rMd = dense ? 'rounded-md' : 'rounded-xl'
  switch (seg) {
    case 'first':
      return dense ? `${rMd} rounded-r-none border-r-transparent` : `${rMd} rounded-r-none border-r-transparent`
    case 'middle':
      return 'rounded-none border-x-transparent px-px'
    case 'last':
      return dense ? `${rMd} rounded-l-none border-l-transparent` : `${rMd} rounded-l-none border-l-transparent`
    default:
      return ''
  }
}

function AssigneeFaceStack({
  assigneeLabels,
  assigneeIds,
  dense,
}: {
  assigneeLabels: readonly string[]
  assigneeIds: readonly string[]
  dense?: boolean
}) {
  const n = Math.min(3, assigneeLabels.length)
  const overflow = assigneeLabels.length - n

  const sizeChip = dense ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[10px]'
  const ring = dense ? '' : 'ring-2 ring-white shadow-sm'

  return (
    <span className={dense ? 'inline-flex items-center -space-x-1' : 'inline-flex items-center -space-x-1.5'} aria-hidden>
      {assigneeLabels.slice(0, n).map((label, idx) => {
        const id = assigneeIds[idx] ?? ''
        const style = getAssigneeBadgeStyle(id || label)
        return (
          <span
            key={`${id || label}-${idx}`}
            title={label}
            className={`relative inline-flex items-center justify-center rounded-full font-bold leading-none text-white ${sizeChip} ${style} ${ring}`}
          >
            {getAssigneeInitials(label)}
          </span>
        )
      })}
      {overflow > 0 ? (
        <span
          className={`relative inline-flex items-center justify-center rounded-full bg-slate-600 font-bold leading-none text-white ${sizeChip} ${ring}`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}

type Props = {
  ev: CalendarEventRow
  /** Display names aligned with calendarEventAssigneeIds order. */
  assigneeLabels: readonly string[]
  /** Calendar column / cell day (`YYYY-MM-DD`) for span segments. Defaults to `ev.date`. */
  calendarDayIso?: string
  compact?: boolean
  fillGrid?: boolean
  /** Minimal single-line pill for month grid cells. */
  monthChip?: boolean
  onClick?: () => void
}

export function EventCard({
  ev,
  assigneeLabels,
  calendarDayIso,
  compact,
  fillGrid,
  monthChip,
  onClick,
}: Props) {
  const barClass = TYPE_BAR[ev.event_type] ?? TYPE_BAR.task
  const displayLocation = calendarEventDisplayLocation(ev)
  const timeRange = formatEventTimeRange(ev)
  const workMin = coerceDurationMinutes(ev.duration_minutes)
  const travelMin = Math.max(0, Math.round(ev.travel_minutes))
  const travelLegs = travelMin > 0 ? splitRoundTripLegs(travelMin) : null
  const totalMin = blockTotalMinutes(ev)
  const ids = calendarEventAssigneeIds(ev)
  const labels =
    assigneeLabels.length > 0 ? [...assigneeLabels] : ids.map(id => id.slice(0, 8))

  const assigneeSummary =
    labels.length > 0 ? `Assigned to ${labels.join(', ')}` : 'Assigned to unknown'
  const assigneeLine = labels.length > 0 ? labels.join(', ') : 'unknown'

  const dayIsoForSpan = calendarDayIso ?? ev.date
  const spanSeg = calendarTaskSpanSegment(ev, dayIsoForSpan)
  const spanShape = spanAccentClass(spanSeg, monthChip)
  const contTitlePrefix =
    spanSeg === 'middle' || spanSeg === 'last' ? (<span aria-hidden className="text-[9px] text-gray-400">↳{' '}</span>) : null

  if (monthChip) {
    return (
      <Tooltip
        content={
          <CondensedTooltipInner
            ev={ev}
            assigneeSummary={assigneeSummary}
            displayLocation={displayLocation}
            timeRange={timeRange}
          />
        }
        className="w-full"
      >
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onClick?.()
          }}
          className={`relative flex w-full items-center gap-1.5 border border-gray-200 bg-white px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight text-gray-900 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 rounded-md ${spanShape}`}
        >
          <span className={`absolute bottom-0.5 left-0 top-0.5 w-0.5 rounded-sm ${barClass}`} aria-hidden />
          <AssigneeFaceStack assigneeLabels={labels} assigneeIds={ids} dense />
          <span className="flex min-w-0 flex-1 items-center truncate">
            {contTitlePrefix}
            <span className="min-w-0 truncate">{ev.title}</span>
          </span>
        </button>
      </Tooltip>
    )
  }

  const teamsGrid = Boolean(compact && fillGrid && !ev.is_full_day)

  return (
    <Tooltip
      content={
        <RichTooltipInner
          ev={ev}
          assigneeSummary={assigneeSummary}
          displayLocation={displayLocation}
          timeRange={timeRange}
          workMin={workMin}
          travelMin={travelMin}
          travelLegs={travelLegs}
          totalMin={totalMin}
        />
      }
      className="flex h-full min-h-0 w-full flex-col"
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onClick?.()
        }}
        className={`group relative box-border h-full min-h-0 w-full border border-gray-200 bg-white text-left shadow-sm transition-all hover:z-[2] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${spanShape || 'rounded-xl'} ${
          teamsGrid
            ? 'flex min-h-0 flex-col overflow-hidden px-2 py-1'
            : fillGrid
              ? 'flex min-h-0 flex-col overflow-hidden py-1 pl-3 pr-1.5'
              : compact
                ? 'px-2 py-1.5 pl-3'
                : 'px-3 py-2.5 pl-4'
        }`}
      >
        <span className={`absolute bottom-0 left-0 top-0 w-1 rounded-l-xl ${barClass}`} aria-hidden />
        <span className="pointer-events-none absolute right-2 top-2 z-[2] shrink-0" aria-hidden>
          <AssigneeFaceStack assigneeLabels={labels} assigneeIds={ids} dense={compact} />
        </span>

        <p
          className={`relative shrink-0 truncate font-semibold leading-tight text-gray-900 ${
            teamsGrid ? 'pr-14 text-xs' : compact ? 'pr-14 text-[10px] line-clamp-2' : 'pr-14 text-sm line-clamp-2'
          }`}
        >
          {(spanSeg === 'middle' || spanSeg === 'last') && <span aria-hidden className="text-[10px] text-gray-400">↳ </span>}
          {ev.title}
        </p>

        {teamsGrid && (
          <div className="relative mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden text-left">
            {timeRange && (
              <p className="truncate text-[11px] leading-tight text-gray-500 whitespace-nowrap">{timeRange}</p>
            )}
            {displayLocation && (
              <p className="line-clamp-1 text-[11px] leading-tight text-gray-500">
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
            <p className="truncate text-[8px] leading-tight text-gray-400">{assigneeLine}</p>
          </div>
        )}

        {!teamsGrid && !compact && (
          <div className="relative mt-1.5 flex flex-col gap-1 text-[11px] text-gray-600">
            {ev.is_full_day ? (
              <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                <IconClock className="h-3 w-3 shrink-0 text-gray-500" aria-hidden />
                {calendarEventIsMultiDayTask(ev) ? timeRange || 'Multi-day task' : 'Full day'}
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
              {assigneeLine}
            </span>
          </div>
        )}

        {!teamsGrid && compact && (
          <div className="relative mt-0.5 min-h-0 flex-1 space-y-0.5 overflow-hidden text-[9px] leading-tight text-gray-600">
            {Boolean(timeRange) && (!ev.is_full_day || calendarEventIsMultiDayTask(ev)) ? (
              <p className="truncate font-medium whitespace-nowrap text-gray-900">{timeRange}</p>
            ) : null}
            {!ev.is_full_day && (
              <p className="truncate text-gray-500">
                {workMin} min{travelMin > 0 ? ` + ${travelMin} travel (rt)` : ''}
              </p>
            )}
            {displayLocation && <p className="line-clamp-1 text-gray-500">{displayLocation}</p>}
            <p className="truncate text-[8px] text-gray-400">{assigneeLine}</p>
          </div>
        )}
      </button>
    </Tooltip>
  )
}
