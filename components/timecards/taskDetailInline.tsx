import type { TimeEntryRow } from '@/components/timecard/timecardTableTypes'

const EMPTY_MARKERS = new Set(['', '—', '-', '–'])

function segment(raw: string | null | undefined, fallback: string): string {
  const t = String(raw ?? '').trim()
  if (!t || EMPTY_MARKERS.has(t)) return fallback
  return t
}

/** Normalized labels for location / work type / task (never em dash placeholders). */
export function taskDetailSegments(row: Pick<TimeEntryRow, 'locationName' | 'workType' | 'task'>) {
  return {
    location: segment(row.locationName, 'No location'),
    workType: segment(row.workType, 'No type'),
    task: segment(row.task, 'No task'),
  }
}

/**
 * Single compact line: Location • Work Type • Task
 * (matches design brief: e.g. "Waurn Ponds • RND • Product Development")
 */
export function TaskDetailInline({ row }: { row: Pick<TimeEntryRow, 'locationName' | 'workType' | 'task'> }) {
  const { location, workType, task } = taskDetailSegments(row)
  const full = `${location} • ${workType} • ${task}`

  return (
    <p
      className="flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-slate-500"
      title={full}
    >
      <span className="min-w-0 max-w-[min(100%,40ch)] truncate">{location}</span>
      <span className="shrink-0 text-slate-400" aria-hidden>
        •
      </span>
      <span className="min-w-0 max-w-[min(100%,32ch)] truncate">{workType}</span>
      <span className="shrink-0 text-slate-400" aria-hidden>
        •
      </span>
      <span className="min-w-0 max-w-[min(100%,40ch)] truncate">{task}</span>
    </p>
  )
}
