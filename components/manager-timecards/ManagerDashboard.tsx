'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import type { PendingTimecardRow } from '@/lib/types/manager-timecards.types'
import { StatusBadge } from '@/components/timecard/StatusBadge'
import { TimecardReviewModal } from '@/components/manager-timecards/TimecardReviewModal'

function formatWeekRange(weekStart: string, weekEnd: string) {
  const a = new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const b = new Date(`${weekEnd}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${a} – ${b}`
}

export function ManagerDashboard() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  const [rows, setRows] = useState<PendingTimecardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [active, setActive] = useState<PendingTimecardRow | null>(null)

  const loadPending = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/manager/timecards/pending', { cache: 'no-store' })
      if (res.status === 403 || res.status === 401) {
        setForbidden(true)
        setRows([])
        return
      }
      if (!res.ok) {
        setLoadError('Could not load pending timecards.')
        setRows([])
        return
      }
      const data = (await res.json()) as { rows?: PendingTimecardRow[] }
      setRows(data.rows ?? [])
    } catch {
      setLoadError('Could not load pending timecards.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) return
    void loadPending()
  }, [authLoading, user?.id, loadPending])

  useEffect(() => {
    if (!forbidden) return
    router.replace('/dashboard')
  }, [forbidden, router])

  const openReview = (row: PendingTimecardRow) => {
    setActive(row)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setActive(null)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-600">
        Redirecting…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Team timecards</h1>
        <p className="mt-0.5 text-xs text-slate-600">
          Submitted weeks awaiting your approval. This page is only available to managers and admins.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading pending approvals…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-800">No pending approvals</p>
            <p className="mt-1 text-xs text-slate-500">When employees submit a week, it will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Week</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Total hours</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => {
                  const ts = row.timesheet
                  const weekLabel = formatWeekRange(ts.week_start_date, ts.week_end_date)
                  const hours = Number(ts.total_hours ?? 0)
                  return (
                    <tr key={ts.id} className="transition-colors hover:bg-slate-50/90">
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-900">{row.employeeName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-700">{weekLabel}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-slate-800">{hours.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={ts.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                          onClick={() => openReview(row)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active ? (
        <TimecardReviewModal
          open={modalOpen}
          onClose={closeModal}
          weekStartIso={active.timesheet.week_start_date}
          employeeUserId={active.employeeUserId}
          employeeName={active.employeeName}
          onRefresh={() => void loadPending()}
        />
      ) : null}
    </div>
  )
}
