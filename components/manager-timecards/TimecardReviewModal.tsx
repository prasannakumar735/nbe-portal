'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { EmployeeTimesheetEntry, EmployeeWeeklyTimesheet } from '@/lib/types/employee-timesheet.types'
import { TimecardTable } from '@/components/timecard/TimecardTable'

type ClientOpt = { id: string; name: string }
type L1 = { id: string; code: string; name: string }
type L2 = { id: string; name: string; billable: boolean }

type Props = {
  open: boolean
  onClose: () => void
  weekStartIso: string
  employeeUserId: string
  employeeName: string
  onRefresh: () => void
}

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

export function TimecardReviewModal({
  open,
  onClose,
  weekStartIso,
  employeeUserId,
  employeeName,
  onRefresh,
}: Props) {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timesheet, setTimesheet] = useState<EmployeeWeeklyTimesheet | null>(null)
  const [entries, setEntries] = useState<EmployeeTimesheetEntry[]>([])

  const [clients, setClients] = useState<ClientOpt[]>([])
  const [level1, setLevel1] = useState<L1[]>([])
  const [level2ByL1, setLevel2ByL1] = useState<Map<string, L2[]>>(new Map())
  const [locationNames, setLocationNames] = useState<Map<string, string>>(new Map())

  const [actionBusy, setActionBusy] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const res = await fetch('/api/maintenance/clients')
        const data = (await res.json()) as { clients?: ClientOpt[] }
        setClients(data.clients ?? [])
      } catch {
        setClients([])
      }
    })()
  }, [open])

  useEffect(() => {
    if (!open) return
    void (async () => {
      const { data, error: e } = await supabase.from('work_type_level1').select('id, code, name').order('code')
      if (!e && data) {
        setLevel1(data.map(r => ({ id: r.id, code: r.code ?? '', name: r.name ?? '' })))
      }
    })()
  }, [open, supabase])

  useEffect(() => {
    if (!open || !weekStartIso || !employeeUserId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const qs = new URLSearchParams({
          weekStart: weekStartIso,
          forUserId: employeeUserId,
        })
        const res = await fetch(`/api/timecard/week?${qs.toString()}`, { cache: 'no-store' })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? 'Failed to load timesheet')
        }
        const data = (await res.json()) as {
          timesheet: EmployeeWeeklyTimesheet | null
          entries: EmployeeTimesheetEntry[]
        }
        if (cancelled) return
        const ent = data.entries ?? []
        setTimesheet(data.timesheet)
        setEntries(ent)

        const l1Ids = [...new Set(ent.map(e => e.work_type_level1_id).filter(Boolean) as string[])]
        const l2Map = new Map<string, L2[]>()
        await Promise.all(
          l1Ids.map(async level1Id => {
            const { data: rows, error: e } = await supabase
              .from('work_type_level2')
              .select('id, name, billable')
              .eq('level1_id', level1Id)
              .order('name')
            if (!e && rows) {
              l2Map.set(
                level1Id,
                rows.map(r => ({ id: r.id, name: r.name ?? '', billable: Boolean(r.billable) })),
              )
            }
          }),
        )
        if (!cancelled) setLevel2ByL1(l2Map)

        const clientIds = [...new Set(ent.map(e => e.client_id).filter(Boolean) as string[])]
        const locMap = new Map<string, string>()
        await Promise.all(
          clientIds.map(async cid => {
            try {
              const lr = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(cid)}`)
              const lj = (await lr.json()) as { locations?: Array<{ id: string; name: string }> }
              for (const loc of lj.locations ?? []) {
                locMap.set(loc.id, loc.name)
              }
            } catch {
              /* ignore */
            }
          }),
        )
        if (!cancelled) setLocationNames(locMap)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load')
          setTimesheet(null)
          setEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, weekStartIso, employeeUserId, supabase])

  const l1Map = useMemo(() => {
    const m = new Map<string, L1>()
    level1.forEach(l => m.set(l.id, l))
    return m
  }, [level1])

  const clientLabel = useCallback(
    (id: string | null) => {
      if (!id) return '—'
      return clients.find(c => c.id === id)?.name ?? '—'
    },
    [clients],
  )

  const locationLabel = useCallback(
    (id: string | null) => (id ? locationNames.get(id) ?? '—' : '—'),
    [locationNames],
  )

  const workTypeLabel = useCallback(
    (l1: string | null, l2: string | null) => {
      const a = l1 ? l1Map.get(l1) : undefined
      const b =
        l1 && l2
          ? (level2ByL1.get(l1) ?? []).find(x => x.id === l2)
          : undefined
      if (!a && !b) return '—'
      return [a?.code, b?.name].filter(Boolean).join(' · ')
    },
    [l1Map, level2ByL1],
  )

  const runReview = async (action: 'approve' | 'reject') => {
    const msg =
      action === 'approve'
        ? 'Approve this timesheet?'
        : 'Reject this timesheet? The employee can edit and resubmit.'
    if (!confirm(msg)) return
    setActionBusy(action)
    try {
      const res = await fetch('/api/timecard/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: weekStartIso,
          employeeUserId,
          action,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(body.error ?? 'Action failed')
        return
      }
      onRefresh()
      onClose()
    } finally {
      setActionBusy(null)
    }
  }

  const weekRange =
    timesheet?.week_start_date && timesheet?.week_end_date
      ? formatWeekRange(timesheet.week_start_date, timesheet.week_end_date)
      : formatWeekRange(weekStartIso, weekStartIso)

  if (!open) return null

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="timecard-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(100dvh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="timecard-review-title" className="text-lg font-semibold tracking-tight text-slate-900">
              Review timesheet
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{employeeName}</span>
              <span className="mx-2 text-slate-300">·</span>
              {weekRange}
            </p>
            {timesheet ? (
              <p className="mt-1 text-sm tabular-nums text-slate-700">
                Total {Number(timesheet.total_hours ?? 0).toFixed(2)} h
                <span className="text-slate-400"> · </span>
                Billable {Number(timesheet.billable_hours ?? 0).toFixed(2)} h
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-600">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Loading timesheet…
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-red-700">{error}</p>
          ) : (
            <TimecardTable
              weekStartIso={weekStartIso}
              entries={entries}
              totalWeekLines={entries.length}
              readOnly
              clientLabel={clientLabel}
              locationLabel={locationLabel}
              workTypeLabel={workTypeLabel}
              onAdd={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onDuplicate={() => {}}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            disabled={loading || !!error || actionBusy !== null || timesheet?.status !== 'submitted'}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 shadow-sm hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void runReview('reject')}
          >
            {actionBusy === 'reject' ? <Loader2 className="inline size-4 animate-spin" /> : null}
            Reject
          </button>
          <button
            type="button"
            disabled={loading || !!error || actionBusy !== null || timesheet?.status !== 'submitted'}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void runReview('approve')}
          >
            {actionBusy === 'approve' ? <Loader2 className="inline size-4 animate-spin" /> : null}
            Approve
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
