'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  addCalendarDays,
  defaultMelbourneAttendanceWeek,
} from '@/lib/officeClock/attendanceRange'
import type { AttendanceDashboard } from '@/lib/officeClock/attendanceDashboard'
import type {
  AttendanceEmployeeOption,
  ManagerAttendanceRow,
} from '@/lib/officeClock/fetchManagerAttendance'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import { downloadAttendanceCsv } from '@/lib/officeClock/exportAttendanceCsv'
import { AttendanceSummaryCards } from '@/components/timecards/AttendanceSummaryCards'
import { AttendanceLiveWidget } from '@/components/timecards/AttendanceLiveWidget'

const navBtnClass =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export function AttendanceTab() {
  const initialWeek = useMemo(() => defaultMelbourneAttendanceWeek(), [])
  const [dateFrom, setDateFrom] = useState(initialWeek.dateFrom)
  const [dateTo, setDateTo] = useState(initialWeek.dateTo)
  const [employeeId, setEmployeeId] = useState('')
  const [employees, setEmployees] = useState<AttendanceEmployeeOption[]>([])
  const [rows, setRows] = useState<ManagerAttendanceRow[]>([])
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const todayMelbourne = useMemo(() => melbourneCalendarDate(new Date()), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ dateFrom, dateTo })
      if (employeeId) params.set('userId', employeeId)
      try {
        const res = await fetch(`/api/manager/office-attendance?${params.toString()}`, {
          cache: 'no-store',
        })
        const j = (await res.json().catch(() => ({}))) as {
          error?: string
          rows?: ManagerAttendanceRow[]
          employees?: AttendanceEmployeeOption[]
          dashboard?: AttendanceDashboard
        }
        if (cancelled) return
        if (!res.ok) {
          setError(typeof j.error === 'string' ? j.error : 'Could not load attendance.')
          setRows([])
          setDashboard(null)
          return
        }
        setRows(j.rows ?? [])
        setDashboard(j.dashboard ?? null)
        if (j.employees?.length) setEmployees(j.employees)
      } catch {
        if (!cancelled) {
          setError('Could not load attendance.')
          setRows([])
          setDashboard(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, employeeId])

  const shiftWeek = (delta: number) => {
    setDateFrom(prev => addCalendarDays(prev, delta * 7))
    setDateTo(prev => addCalendarDays(prev, delta * 7))
  }

  const jumpToToday = () => {
    setDateFrom(todayMelbourne)
    setDateTo(todayMelbourne)
  }

  const jumpToCurrentWeek = () => {
    const w = defaultMelbourneAttendanceWeek()
    setDateFrom(w.dateFrom)
    setDateTo(w.dateTo)
  }

  const onExport = () => {
    downloadAttendanceCsv(`nbe-attendance-${dateFrom}_${dateTo}.csv`, rows)
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-xs text-slate-500">
        Office QR sign-in and sign-out times (Australia/Melbourne).
      </p>

      <AttendanceSummaryCards dashboard={dashboard} isLoading={loading} />

      <AttendanceLiveWidget
        todayMelbourne={dashboard?.todayMelbourne ?? todayMelbourne}
        signedInNow={dashboard?.signedInNow ?? []}
        isLoading={loading}
        onSelectEmployee={id => setEmployeeId(id)}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Filters &amp; log</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={jumpToToday}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={jumpToCurrentWeek}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              This week
            </button>
            {employeeId ? (
              <button
                type="button"
                onClick={() => setEmployeeId('')}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Clear employee filter
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={navBtnClass}
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              Previous
            </button>
            <button
              type="button"
              className={navBtnClass}
              onClick={() => shiftWeek(1)}
            >
              Next
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              className={navBtnClass}
              onClick={onExport}
              disabled={loading || rows.length === 0}
            >
              <Download className="size-4 shrink-0" aria-hidden />
              Export CSV
            </button>
          </div>

          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
            Employee
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="">All employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value.slice(0, 10))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value.slice(0, 10))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <div className="animate-pulse h-48 rounded-xl bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No attendance records for this range.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Sign in</th>
                  <th className="px-3 py-2">Sign out</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.sessionId} className="text-slate-800">
                    <td className="px-3 py-2 font-medium">{r.employeeName}</td>
                    <td className="px-3 py-2 tabular-nums">{r.dateMelbourne}</td>
                    <td className="px-3 py-2 tabular-nums">{r.signInMelbourne}</td>
                    <td className="px-3 py-2 tabular-nums">{r.signOutMelbourne ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.durationDisplay ?? '—'}
                    </td>
                    <td className="px-3 py-2">{r.siteName}</td>
                    <td className="px-3 py-2">
                      {r.status === 'open' ? (
                        <span className="text-amber-700">Signed in</span>
                      ) : r.status === 'system_logged_out' ? (
                        <span className="text-indigo-700">System logged out</span>
                      ) : (
                        <span className="text-slate-600">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map(r => (
              <li key={r.sessionId} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="font-semibold text-slate-900">{r.employeeName}</div>
                <div className="mt-1 text-slate-600">
                  {r.dateMelbourne} · {r.signInMelbourne}
                  {r.signOutMelbourne ? ` – ${r.signOutMelbourne}` : ' · Signed in'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {r.siteName}
                  {r.durationDisplay ? ` · ${r.durationDisplay}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
