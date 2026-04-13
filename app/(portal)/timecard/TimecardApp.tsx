'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardPaste } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers/AuthProvider'
import { canApproveTimesheet } from '@/lib/auth/roles'
import { addDays, startOfIsoWeekMonday, toIsoDateString } from '@/lib/timecard/weekDates'
import { createEmptyEntry, useTimecard } from '@/hooks/useTimecard'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import {
  ApprovalActions,
  TimecardModal,
  TimecardFilters,
  TimecardHeader,
  TimecardSkeleton,
  TimecardSummary,
  WeekView,
  buildTimesheetCsv,
  downloadTimesheetCsv,
} from '@/components/timecard'
import type { BillableFilterValue } from '@/components/timecard'
import { mergeLastUsedIntoEntry, writeLastUsedEntryPrefs } from '@/lib/timecard/lastUsedDefaults'

type ClientOpt = { id: string; name: string }
type LocOpt = { id: string; name: string }
type L1 = { id: string; code: string; name: string }
type L2 = { id: string; name: string; billable: boolean }

export default function TimecardApp() {
  const searchParams = useSearchParams()
  const { user, profile, isLoading: authLoading, isAdmin, isManager } = useAuth()
  const supabase = useMemo(() => createSupabaseClient(), [])

  const [weekStart, setWeekStart] = useState(() => startOfIsoWeekMonday(new Date()))
  const weekStartIso = toIsoDateString(weekStart)
  const weekEndIso = useMemo(() => toIsoDateString(addDays(weekStart, 6)), [weekStart])

  const viewUserId = searchParams.get('user')?.trim() || null
  const timesheetOwnerId = useMemo(() => {
    if (!user?.id) return null
    if (viewUserId && (isAdmin || isManager)) return viewUserId
    return user.id
  }, [user?.id, viewUserId, isAdmin, isManager])

  const [clients, setClients] = useState<ClientOpt[]>([])
  const [locations, setLocations] = useState<LocOpt[]>([])
  const [level1, setLevel1] = useState<L1[]>([])
  const [level2, setLevel2] = useState<L2[]>([])

  const [filterClientId, setFilterClientId] = useState('')
  const [billableFilter, setBillableFilter] = useState<BillableFilterValue>('all')
  const [dateFrom, setDateFrom] = useState(weekStartIso)
  const [dateTo, setDateTo] = useState(weekEndIso)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalEntry, setModalEntry] = useState<EmployeeTimesheetEntry | null>(null)

  const [reviewBusy, setReviewBusy] = useState<'approve' | 'reject' | null>(null)

  const tc = useTimecard(user?.id ? weekStartIso : null, user?.id ?? null, timesheetOwnerId ?? undefined)

  useEffect(() => {
    setDateFrom(weekStartIso)
    setDateTo(weekEndIso)
  }, [weekStartIso, weekEndIso])

  const filteredEntries = useMemo(() => {
    const from = (dateFrom || weekStartIso).slice(0, 10)
    const to = (dateTo || weekEndIso).slice(0, 10)
    return tc.entries.filter(e => {
      if (filterClientId && e.client_id !== filterClientId) return false
      if (billableFilter === 'yes' && !e.billable) return false
      if (billableFilter === 'no' && e.billable) return false
      const d = e.entry_date.slice(0, 10)
      if (d < from || d > to) return false
      return true
    })
  }, [tc.entries, filterClientId, billableFilter, dateFrom, dateTo, weekStartIso, weekEndIso])

  const clientMap = useMemo(() => {
    const m = new Map<string, string>()
    clients.forEach(c => m.set(c.id, c.name))
    return m
  }, [clients])

  const locationMap = useMemo(() => {
    const m = new Map<string, string>()
    locations.forEach(l => m.set(l.id, l.name))
    return m
  }, [locations])

  const l1Map = useMemo(() => {
    const m = new Map<string, L1>()
    level1.forEach(l => m.set(l.id, l))
    return m
  }, [level1])

  const l2Map = useMemo(() => {
    const m = new Map<string, L2>()
    level2.forEach(l => m.set(l.id, l))
    return m
  }, [level2])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/maintenance/clients')
        const data = (await res.json()) as { clients?: ClientOpt[] }
        setClients(data.clients ?? [])
      } catch {
        setClients([])
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('work_type_level1').select('id, code, name').order('code')
      if (!error && data) {
        setLevel1(data.map(r => ({ id: r.id, code: r.code ?? '', name: r.name ?? '' })))
      }
    })()
  }, [supabase])

  const loadLocations = useCallback(
    async (clientId: string) => {
      if (!clientId) {
        setLocations([])
        return
      }
      try {
        const res = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`)
        const data = (await res.json()) as { locations?: Array<{ id: string; name: string }> }
        setLocations((data.locations ?? []).map(l => ({ id: l.id, name: l.name })))
      } catch {
        setLocations([])
      }
    },
    [],
  )

  const loadLevel2 = useCallback(
    async (level1Id: string) => {
      if (!level1Id) {
        setLevel2([])
        return
      }
      const { data, error } = await supabase
        .from('work_type_level2')
        .select('id, name, billable')
        .eq('level1_id', level1Id)
        .order('name')
      if (!error && data) {
        setLevel2(data.map(r => ({ id: r.id, name: r.name ?? '', billable: Boolean(r.billable) })))
      } else {
        setLevel2([])
      }
    },
    [supabase],
  )

  const handleModalClientChange = useCallback(
    async (clientId: string) => {
      await loadLocations(clientId)
    },
    [loadLocations],
  )

  const handleModalLevel1Change = useCallback(
    async (level1Id: string) => {
      await loadLevel2(level1Id)
    },
    [loadLevel2],
  )

  const clientLabel = useCallback(
    (id: string | null) => (id ? clientMap.get(id) ?? '—' : '—'),
    [clientMap],
  )

  const locationLabel = useCallback(
    (id: string | null) => (id ? locationMap.get(id) ?? '—' : '—'),
    [locationMap],
  )

  const workTypeLabel = useCallback(
    (l1: string | null, l2: string | null) => {
      const a = l1 ? l1Map.get(l1) : undefined
      const b = l2 ? l2Map.get(l2) : undefined
      if (!a && !b) return '—'
      return [a?.code, b?.name].filter(Boolean).join(' · ')
    },
    [l1Map, l2Map],
  )

  const saveModal = (entry: EmployeeTimesheetEntry) => {
    writeLastUsedEntryPrefs(entry)
    const exists = tc.entries.some(e => e.id === entry.id)
    if (exists) {
      tc.updateEntry(entry.id, entry)
    } else {
      tc.setEntries(prev => [...prev, entry])
    }
    setModalOpen(false)
    setModalEntry(null)
  }

  const exportCsv = useCallback(() => {
    const csv = buildTimesheetCsv(filteredEntries, {
      clientName: id => (id ? clientMap.get(id) ?? '' : ''),
      locationName: id => (id ? locationMap.get(id) ?? '' : ''),
      workTypeLabel,
    })
    downloadTimesheetCsv(`timecard-${weekStartIso}.csv`, csv)
  }, [filteredEntries, clientMap, locationMap, workTypeLabel, weekStartIso])

  const openEdit = (e: EmployeeTimesheetEntry) => {
    setLocations([])
    setLevel2([])
    setModalEntry(e)
    setModalOpen(true)
  }

  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))

  const weekSubtitle = useMemo(() => {
    const end = addDays(weekStart, 6)
    const a = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const b = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    return `Week ${a} – ${b}`
  }, [weekStart])

  const sortedEntries = useMemo(
    () =>
      [...filteredEntries].sort(
        (a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order,
      ),
    [filteredEntries],
  )

  const entryOrderIndex = useMemo(() => {
    if (!modalEntry) return -1
    return sortedEntries.findIndex(e => e.id === modalEntry.id)
  }, [modalEntry, sortedEntries])

  const canFillFromPrevious = entryOrderIndex > 0

  const fillModalFromPrevious = useCallback(() => {
    if (!modalEntry || entryOrderIndex <= 0) return
    const prev = sortedEntries[entryOrderIndex - 1]!
    setLocations([])
    setLevel2([])
    setModalEntry({
      ...prev,
      id: modalEntry.id,
      entry_date: modalEntry.entry_date,
      sort_order: modalEntry.sort_order,
      gps_start: modalEntry.gps_start,
      gps_end: modalEntry.gps_end,
    })
  }, [modalEntry, entryOrderIndex, sortedEntries])

  const handleSubmitWeek = useCallback(async () => {
    await tc.syncNow()
    const ok = await tc.submitWeek()
    if (!ok) {
      alert('Submit failed. Save online and try again.')
    }
  }, [tc])

  const showManagerReview =
    tc.isManagerView && canApproveTimesheet(profile) && tc.timesheet?.status === 'submitted'

  const runReview = useCallback(
    async (action: 'approve' | 'reject') => {
      if (!timesheetOwnerId || !weekStartIso) return
      setReviewBusy(action)
      try {
        const res = await fetch('/api/timecard/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekStart: weekStartIso,
            employeeUserId: timesheetOwnerId,
            action,
          }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          alert(err.error ?? 'Review failed.')
          return
        }
        await tc.refreshFromServer()
      } finally {
        setReviewBusy(null)
      }
    },
    [timesheetOwnerId, weekStartIso, tc],
  )

  if (authLoading) {
    return <TimecardSkeleton />
  }
  if (!user?.id) {
    return <div className="w-full min-w-0 py-4 text-slate-600">Sign in to use the timecard.</div>
  }

  if (tc.status === 'loading') {
    return <TimecardSkeleton />
  }

  if (tc.status === 'error') {
    return (
      <div className="w-full min-w-0 py-4">
        <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-700">Unable to load timecard.</p>
          <button
            type="button"
            className="mt-4 h-9 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => void tc.refreshFromServer()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const timesheetStatus = tc.timesheet?.status ?? 'draft'

  return (
    <div className="w-full min-w-0 space-y-5">
        {(isAdmin || isManager) && !tc.isManagerView ? (
          <p className="text-xs text-slate-500">
            Manager review: open{' '}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
              /timecard?user=&lt;employee user id&gt;
            </code>
          </p>
        ) : null}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between xl:gap-6">
          <div className="min-w-0 flex-1">
            <TimecardHeader
              subtitle={weekSubtitle}
              timesheetStatus={timesheetStatus}
              saveStatus={tc.saveStatus}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
              onExportCsv={exportCsv}
              onSubmitWeek={handleSubmitWeek}
              submitDisabled={tc.entries.length === 0}
              readOnly={tc.isReadOnly}
            />
          </div>
          {showManagerReview ? (
            <div className="shrink-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 xl:max-w-md">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Review</p>
              <ApprovalActions
                busyAction={reviewBusy}
                onApprove={() => runReview('approve')}
                onReject={() => {
                  if (confirm('Reject this timesheet? The employee can edit and resubmit.')) {
                    void runReview('reject')
                  }
                }}
              />
            </div>
          ) : null}
        </div>

        <TimecardSummary entries={tc.entries} />

        <TimecardFilters
          clients={clients}
          clientId={filterClientId}
          onClientIdChange={setFilterClientId}
          billable={billableFilter}
          onBillableChange={setBillableFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          weekMin={weekStartIso}
          weekMax={weekEndIso}
        />

        {!tc.isReadOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              onClick={() => {
                tc.copyPreviousEntry(weekStartIso)
              }}
            >
              <ClipboardPaste className="size-4 shrink-0 text-slate-500" aria-hidden />
              Copy previous entry
            </button>
          </div>
        ) : null}

        <WeekView
          weekStartIso={weekStartIso}
          entries={filteredEntries}
          totalWeekLines={tc.entries.length}
          readOnly={tc.isReadOnly}
          clientLabel={clientLabel}
          locationLabel={locationLabel}
          workTypeLabel={workTypeLabel}
          onAdd={date => {
            const base = createEmptyEntry(date)
            const merged = mergeLastUsedIntoEntry(base)
            setLocations([])
            setLevel2([])
            setModalEntry(merged)
            setModalOpen(true)
          }}
          onEdit={e => openEdit(e)}
          onDelete={id => tc.removeEntry(id)}
          onDuplicate={id => tc.duplicateEntry(id)}
        />

      <TimecardModal
        open={modalOpen}
        entry={modalEntry}
        readOnly={tc.isReadOnly}
        onClose={() => {
          setModalOpen(false)
          setModalEntry(null)
        }}
        onSave={saveModal}
        onFillFromPrevious={fillModalFromPrevious}
        canFillFromPrevious={canFillFromPrevious}
        onDuplicateEntry={() => {
          if (!modalEntry) return
          tc.duplicateEntry(modalEntry.id)
          setModalOpen(false)
          setModalEntry(null)
        }}
        clients={clients}
        locations={locations}
        level1Options={level1}
        level2Options={level2}
        onClientChange={handleModalClientChange}
        onLevel1Change={handleModalLevel1Change}
      />
    </div>
  )
}
