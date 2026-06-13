'use client'

import type { AttendanceSignedInNowRow } from '@/lib/officeClock/attendanceDashboard'

const LIVE_LIST_MAX = 8

type Props = {
  todayMelbourne: string
  signedInNow: AttendanceSignedInNowRow[]
  isLoading?: boolean
  onSelectEmployee?: (userId: string) => void
}

export function AttendanceLiveWidget({
  todayMelbourne,
  signedInNow,
  isLoading,
  onSelectEmployee,
}: Props) {
  const shown = signedInNow.slice(0, LIVE_LIST_MAX)
  const extra = signedInNow.length - shown.length

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Who&apos;s in the office</h2>
          <p className="text-xs text-slate-500">Live open sessions · today {todayMelbourne} (Melbourne)</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
          {isLoading ? '—' : signedInNow.length} signed in
        </span>
      </div>

      {isLoading ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-slate-100" />
      ) : signedInNow.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No one is currently signed in at the office.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {shown.map(row => (
            <li key={row.sessionId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                {onSelectEmployee ? (
                  <button
                    type="button"
                    onClick={() => onSelectEmployee(row.userId)}
                    className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {row.employeeName}
                  </button>
                ) : (
                  <span className="font-medium text-slate-900">{row.employeeName}</span>
                )}
                <p className="text-xs text-slate-500">
                  {row.dateMelbourne === todayMelbourne ? 'Today' : row.dateMelbourne} · in {row.signInMelbourne} ·{' '}
                  {row.siteName}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-amber-700">Signed in</span>
            </li>
          ))}
        </ul>
      )}

      {extra > 0 ? (
        <p className="mt-2 text-xs text-slate-500">+ {extra} more — use filters below to view all.</p>
      ) : null}
    </div>
  )
}
