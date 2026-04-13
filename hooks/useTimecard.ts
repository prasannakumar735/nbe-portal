'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  idbDeleteSync,
  idbEnqueueSync,
  idbGetEntriesForWeek,
  idbGetWeekMeta,
  idbPutWeekMeta,
  idbReplaceWeekEntries,
  weekKey as makeWeekKey,
} from '@/lib/offline/timecard-idb'
import type {
  EmployeeTimesheetEntry,
  EmployeeWeeklyTimesheet,
  TimecardSaveStatus,
} from '@/lib/types/employee-timesheet.types'
import { computeEntryTotalHours } from '@/lib/timecard/computeHours'
import {
  dedupeTimesheetEntriesById,
  findDuplicateEntryIds,
} from '@/lib/timecard/dedupeTimesheetEntries'

const SYNC_DEBOUNCE_MS = 500
const SYNC_QUEUE_ID = (wk: string) => `sync::${wk}`

export function createEmptyEntry(entryDateIso: string): EmployeeTimesheetEntry {
  const start_time = '09:00'
  const end_time = '17:00'
  const break_minutes = 30
  const { hours } = computeEntryTotalHours(start_time, end_time, break_minutes)
  return {
    id: crypto.randomUUID(),
    entry_date: entryDateIso,
    client_id: null,
    location_id: null,
    work_type_level1_id: null,
    work_type_level2_id: null,
    task: '',
    start_time,
    end_time,
    break_minutes,
    total_hours: hours,
    billable: true,
    notes: '',
    gps_start: null,
    gps_end: null,
    gps_start_address: null,
    gps_start_meta: null,
    gps_end_address: null,
    gps_end_meta: null,
    sort_order: 0,
  }
}

function recalcEntry(e: EmployeeTimesheetEntry): EmployeeTimesheetEntry {
  const { hours, error } = computeEntryTotalHours(e.start_time, e.end_time, e.break_minutes)
  return {
    ...e,
    gps_start_address: e.gps_start_address ?? null,
    gps_start_meta: e.gps_start_meta ?? null,
    gps_end_address: e.gps_end_address ?? null,
    gps_end_meta: e.gps_end_meta ?? null,
    total_hours: error ? e.total_hours : hours,
  }
}

/** Dedupe ids, sort by day + order, renumber `sort_order` — single source of truth for week state. */
function normalizeWeekEntries(ent: EmployeeTimesheetEntry[]): EmployeeTimesheetEntry[] {
  if (ent.length === 0) return []
  const dupIds = findDuplicateEntryIds(ent)
  if (dupIds.size > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[useTimecard] Duplicate entry ids removed:', [...dupIds])
    }
  }
  const unique = dedupeTimesheetEntriesById(ent)
  const sorted = [...unique].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order,
  )
  return sorted.map((e, i) => recalcEntry({ ...e, sort_order: i }))
}

export type UseTimecardResult = {
  timesheet: EmployeeWeeklyTimesheet | null
  entries: EmployeeTimesheetEntry[]
  status: 'loading' | 'ready' | 'error'
  saveStatus: TimecardSaveStatus
  /** True when viewing another user’s week (manager review); lines are read-only. */
  isManagerView: boolean
  isReadOnly: boolean
  setEntries: (next: EmployeeTimesheetEntry[] | ((prev: EmployeeTimesheetEntry[]) => EmployeeTimesheetEntry[])) => void
  addEntry: (dateIso: string) => void
  removeEntry: (id: string) => void
  updateEntry: (id: string, patch: Partial<EmployeeTimesheetEntry>) => void
  copyPreviousEntry: (dateIso: string) => void
  duplicateEntry: (id: string) => void
  submitWeek: () => Promise<boolean>
  syncNow: () => Promise<void>
  refreshFromServer: () => Promise<void>
}

export function formatTimecardSaveStatus(s: TimecardSaveStatus): string {
  switch (s) {
    case 'saving':
      return 'Saving…'
    case 'saved_offline':
      return 'Saved offline'
    case 'synced':
      return 'Synced'
    case 'error':
      return 'Save error'
    default:
      return ''
  }
}

/**
 * @param weekStartIso Monday date YYYY-MM-DD
 * @param sessionUserId Authenticated user (for API)
 * @param timesheetOwnerId Whose timesheet to load (defaults to session user)
 *
 * Offline: week entries (including `gps_start` / `gps_end`) persist in IndexedDB and sync via `POST /api/timecard/week` when online; the API fills addresses and denormalised lat/lng columns.
 */
export function useTimecard(
  weekStartIso: string | null,
  sessionUserId: string | null,
  timesheetOwnerId: string | null = sessionUserId,
): UseTimecardResult {
  const ownerId = timesheetOwnerId ?? sessionUserId
  const isManagerView = Boolean(sessionUserId && ownerId && sessionUserId !== ownerId)

  const [timesheet, setTimesheet] = useState<EmployeeWeeklyTimesheet | null>(null)
  const [entries, setEntriesState] = useState<EmployeeTimesheetEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saveStatus, setSaveStatus] = useState<TimecardSaveStatus>('idle')

  const genRef = useRef(0)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Serializes debounced syncs so concurrent POSTs cannot reorder or duplicate server writes. */
  const syncTailRef = useRef(Promise.resolve())
  const entriesRef = useRef<EmployeeTimesheetEntry[]>([])
  const timesheetRef = useRef<EmployeeWeeklyTimesheet | null>(null)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  useEffect(() => {
    timesheetRef.current = timesheet
  }, [timesheet])

  const wk = useMemo(
    () => (ownerId && weekStartIso ? makeWeekKey(ownerId, weekStartIso) : null),
    [ownerId, weekStartIso],
  )

  /** Persist full week to IndexedDB (called after state updates). */
  const persistIdb = useCallback(
    async (ent: EmployeeTimesheetEntry[], ts: EmployeeWeeklyTimesheet | null) => {
      if (isManagerView || !wk || !ownerId || !weekStartIso) return
      const now = Date.now()
      const normalized = normalizeWeekEntries(ent)
      await idbPutWeekMeta({
        key: wk,
        userId: ownerId,
        weekStart: weekStartIso,
        timesheet: ts,
        updatedAt: now,
      })
      await idbReplaceWeekEntries(
        wk,
        normalized.map(e => ({ id: e.id, weekKey: wk, data: e, updatedAt: now })),
      )
    },
    [ownerId, weekStartIso, wk, isManagerView],
  )

  useEffect(() => {
    if (status !== 'ready' || !wk || isManagerView) return
    void persistIdb(entries, timesheet)
  }, [entries, timesheet, status, wk, persistIdb, isManagerView])

  const scheduleServerSync = useCallback(() => {
    if (isManagerView || !weekStartIso || !sessionUserId || !ownerId) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      syncTailRef.current = syncTailRef.current
        .then(async () => {
          setSaveStatus('saving')
          try {
            const payload = {
              weekStart: weekStartIso,
              entries: normalizeWeekEntries(entriesRef.current),
            }
            if (wk) {
              await idbEnqueueSync({
                id: SYNC_QUEUE_ID(wk),
                weekKey: wk,
                userId: ownerId,
                payloadJson: JSON.stringify(payload),
                status: 'pending',
                retryCount: 0,
                updatedAt: Date.now(),
              })
            }
            const res = await fetch('/api/timecard/week', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (!res.ok) {
              setSaveStatus('saved_offline')
              return
            }
            const data = (await res.json()) as {
              timesheet: EmployeeWeeklyTimesheet | null
              entries: EmployeeTimesheetEntry[]
            }
            setTimesheet(data.timesheet)
            setEntriesState(normalizeWeekEntries(data.entries ?? []))
            if (wk) {
              await idbDeleteSync(SYNC_QUEUE_ID(wk))
            }
            setSaveStatus('synced')
          } catch {
            setSaveStatus('saved_offline')
          }
        })
        .catch(err => {
          console.warn('[useTimecard] sync queue', err)
          setSaveStatus('saved_offline')
        })
    }, SYNC_DEBOUNCE_MS)
  }, [sessionUserId, ownerId, weekStartIso, wk, isManagerView])

  const setEntries: UseTimecardResult['setEntries'] = useCallback(
    next => {
      if (isManagerView) return
      const ts = timesheetRef.current
      if (ts && ts.status !== 'draft' && ts.status !== 'rejected') {
        return
      }
      setSaveStatus('saving')
      setEntriesState(prev => {
        const resolved = typeof next === 'function' ? next(prev) : next
        return normalizeWeekEntries(resolved)
      })
      scheduleServerSync()
    },
    [scheduleServerSync, isManagerView],
  )

  const hydrate = useCallback(async () => {
    if (!weekStartIso || !sessionUserId || !ownerId || !wk) {
      setStatus('error')
      return
    }
    const gen = ++genRef.current
    setStatus('loading')
    try {
      let serverOk = false
      let serverPayload: { timesheet: EmployeeWeeklyTimesheet | null; entries: EmployeeTimesheetEntry[] } | null = null
      try {
        const forQ =
          ownerId !== sessionUserId ? `&forUserId=${encodeURIComponent(ownerId)}` : ''
        const res = await fetch(
          `/api/timecard/week?weekStart=${encodeURIComponent(weekStartIso)}${forQ}`,
          { cache: 'no-store' },
        )
        serverOk = res.ok
        if (res.ok) {
          serverPayload = (await res.json()) as { timesheet: EmployeeWeeklyTimesheet | null; entries: EmployeeTimesheetEntry[] }
        }
      } catch {
        serverOk = false
      }

      if (gen !== genRef.current) return

      if (serverOk && serverPayload) {
        setTimesheet(serverPayload.timesheet)
        setEntriesState(normalizeWeekEntries(serverPayload.entries ?? []))
        await idbPutWeekMeta({
          key: wk,
          userId: ownerId,
          weekStart: weekStartIso,
          timesheet: serverPayload.timesheet,
          updatedAt: Date.now(),
        })
        await idbReplaceWeekEntries(
          wk,
          normalizeWeekEntries(serverPayload.entries ?? []).map(e => ({
            id: e.id,
            weekKey: wk,
            data: e,
            updatedAt: Date.now(),
          })),
        )
        setSaveStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'saved_offline')
        setStatus('ready')
        return
      }

      const localMeta = await idbGetWeekMeta(wk)
      const rows = await idbGetEntriesForWeek(wk)
      if (rows.length > 0 || localMeta?.timesheet) {
        setTimesheet(localMeta?.timesheet ?? null)
        setEntriesState(normalizeWeekEntries(rows.map(r => r.data)))
        setSaveStatus('saved_offline')
        setStatus('ready')
        return
      }

      setTimesheet(null)
      setEntriesState([])
      setSaveStatus('idle')
      setStatus('ready')
    } catch {
      if (gen !== genRef.current) return
      setStatus('error')
      setSaveStatus('error')
    }
  }, [sessionUserId, ownerId, weekStartIso, wk])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const isWeekLocked = useCallback(() => {
    const s = timesheetRef.current?.status
    return s != null && s !== 'draft' && s !== 'rejected'
  }, [])

  const addEntry = useCallback(
    (dateIso: string) => {
      if (isManagerView) return
      if (isWeekLocked()) return
      const row = createEmptyEntry(dateIso)
      setEntries(prev => [...prev, row])
    },
    [setEntries, isWeekLocked, isManagerView],
  )

  const removeEntry = useCallback(
    (id: string) => {
      if (isManagerView) return
      if (isWeekLocked()) return
      setEntries(prev => prev.filter(e => e.id !== id))
    },
    [setEntries, isWeekLocked, isManagerView],
  )

  const updateEntry = useCallback(
    (id: string, patch: Partial<EmployeeTimesheetEntry>) => {
      if (isManagerView) return
      if (isWeekLocked()) return
      setEntries(prev => prev.map(e => (e.id === id ? recalcEntry({ ...e, ...patch }) : e)))
    },
    [setEntries, isWeekLocked, isManagerView],
  )

  const copyPreviousEntry = useCallback(
    (dateIso: string) => {
      if (isManagerView) return
      if (isWeekLocked()) return
      setEntries(prev => {
        if (prev.length === 0) {
          return [createEmptyEntry(dateIso)]
        }
        const last = prev[prev.length - 1]
        const clone: EmployeeTimesheetEntry = {
          ...last,
          id: crypto.randomUUID(),
          entry_date: dateIso,
        }
        return [...prev, recalcEntry(clone)]
      })
    },
    [setEntries, isWeekLocked, isManagerView],
  )

  const duplicateEntry = useCallback(
    (id: string) => {
      if (isManagerView) return
      if (isWeekLocked()) return
      setEntries(prev => {
        const src = prev.find(e => e.id === id)
        if (!src) return prev
        const copy: EmployeeTimesheetEntry = {
          ...src,
          id: crypto.randomUUID(),
        }
        return [...prev, recalcEntry(copy)]
      })
    },
    [setEntries, isWeekLocked, isManagerView],
  )

  const submitWeek = useCallback(async () => {
    if (isManagerView || !weekStartIso) return false
    try {
      const res = await fetch('/api/timecard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekStartIso }),
      })
      if (!res.ok) return false
      const data = (await res.json()) as { timesheet: EmployeeWeeklyTimesheet }
      setTimesheet(data.timesheet)
      await hydrate()
      return true
    } catch {
      return false
    }
  }, [weekStartIso, hydrate, isManagerView])

  const syncNow = useCallback(async () => {
    if (isManagerView || !weekStartIso) return
    setSaveStatus('saving')
    try {
      const payload = {
        weekStart: weekStartIso,
        entries: normalizeWeekEntries(entriesRef.current),
      }
      const res = await fetch('/api/timecard/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok && wk) {
        await idbDeleteSync(SYNC_QUEUE_ID(wk))
      }
      setSaveStatus(res.ok ? 'synced' : 'saved_offline')
      await hydrate()
    } catch {
      setSaveStatus('saved_offline')
    }
  }, [weekStartIso, hydrate, wk, isManagerView])

  const refreshFromServer = useCallback(async () => {
    await hydrate()
  }, [hydrate])

  useEffect(() => {
    const onOnline = () => {
      void syncNow()
    }
    if (typeof window === 'undefined') return
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [syncNow])

  const isReadOnly =
    isManagerView ||
    (timesheet != null && timesheet.status !== 'draft' && timesheet.status !== 'rejected')

  return {
    timesheet,
    entries,
    status,
    saveStatus,
    isManagerView,
    isReadOnly,
    setEntries,
    addEntry,
    removeEntry,
    updateEntry,
    copyPreviousEntry,
    duplicateEntry,
    submitWeek,
    syncNow,
    refreshFromServer,
  }
}
