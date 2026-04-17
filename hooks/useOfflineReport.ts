'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapDraftApiReportToForm } from '@/lib/offline/draft-report-map'
import { mergeMaintenanceReportState } from '@/lib/offline/merge-maintenance-report'
import {
  idbGetDoorsForReport,
  idbGetReport,
  idbListSyncQueueForReport,
  idbPutDoor,
  idbPutReport,
  idbPushReportVersion,
  idbPutSyncQueue,
} from '@/lib/offline/maintenance-report-idb'
import { buildDraftPayload, createMaintenanceReportSyncEngine } from '@/lib/offline/maintenance-report-sync'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import type {
  OfflineConflictInfo,
  OfflineDoorRow,
  OfflineReportHeader,
  OfflineReportRow,
  OfflineSaveUiStatus,
  SyncQueueRow,
} from '@/lib/types/offline-report.types'

const PERSIST_DEBOUNCE_MS = 700
const VERSION_DEBOUNCE_MS = 5000

function omitDoors(form: MaintenanceFormValues): OfflineReportHeader {
  const { doors: _d, ...rest } = form
  return rest
}

function stableQueueId(reportId: string): string {
  return `sync-${reportId}`
}

function formFromLocalOnly(reportId: string, meta: OfflineReportRow, doorRows: OfflineDoorRow[]): MaintenanceFormValues {
  const doors = [...doorRows]
    .sort((a, b) => String(a.data.door_number).localeCompare(String(b.data.door_number)))
    .map(r => r.data)
  return {
    ...meta.header,
    report_id: reportId,
    doors: doors.length > 0 ? doors : [],
  }
}

async function persistMergedToIdb(
  reportId: string,
  form: MaintenanceFormValues,
  doorUpdatedAt: Record<string, number>,
  lastKnownServerUpdatedAt: string | null,
  localRevisionAt: number,
): Promise<void> {
  const now = Date.now()
  const header = omitDoors(form)
  const row: OfflineReportRow = {
    reportId,
    updatedAt: now,
    localRevisionAt,
    lastKnownServerUpdatedAt,
    header: { ...header, report_id: reportId },
  }
  await idbPutReport(row)

  for (const door of form.doors ?? []) {
    const ts = doorUpdatedAt[door.local_id] ?? now
    await idbPutDoor({
      id: door.local_id,
      reportId,
      data: door,
      updatedAt: ts,
    })
  }
}

export type UseOfflineReportResult = {
  status: 'loading' | 'ready' | 'error'
  /** Server `maintenance_reports.status` when available (for lock rules in the form). */
  reportStatus: string | null
  saveStatus: OfflineSaveUiStatus
  /** Merged form values — pass to maintenance form as `initialReport`. */
  initialForm: MaintenanceFormValues | null
  /** Pass through to `MaintenanceInspectionForm` as `initialReport` (serialisable). */
  initialReportRecord: Record<string, unknown> | null
  conflict: OfflineConflictInfo | null
  /** Debounced (300ms) persist of full form to IndexedDB + sync queue. */
  persistForm: (form: MaintenanceFormValues) => void
  /** Flush pending writes immediately (e.g. before navigate). */
  flushPersist: () => Promise<void>
  /** Run sync engine once. */
  syncNow: () => Promise<void>
  /** After a conflict, reload from server and rehydrate IDB. */
  resolveConflictRefresh: () => Promise<void>
  /** True while unsynced queue rows exist for this report. */
  hasPendingSync: boolean
}

export function formatOfflineSaveStatus(saveStatus: OfflineSaveUiStatus): string {
  switch (saveStatus) {
    case 'loading':
      return 'Restoring from device…'
    case 'saving_local':
      return 'Saving locally…'
    case 'saved_offline':
      return 'Saved offline'
    case 'syncing':
      return 'Syncing…'
    case 'synced':
      return 'Synced'
    case 'error':
      return 'Sync issue — check connection'
    default:
      return ''
  }
}

export function useOfflineReport(reportId: string | null): UseOfflineReportResult {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reportStatus, setReportStatus] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<OfflineSaveUiStatus>('loading')
  const [initialForm, setInitialForm] = useState<MaintenanceFormValues | null>(null)
  /** Fields returned by draft GET that are not on `MaintenanceFormValues` but used by the form UI (saved labels). */
  const [reportAuxFields, setReportAuxFields] = useState<Record<string, unknown>>({})
  const [conflict, setConflict] = useState<OfflineConflictInfo | null>(null)
  const [hasPendingSync, setHasPendingSync] = useState(false)
  const hasPendingSyncRef = useRef(false)

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFormRef = useRef<MaintenanceFormValues | null>(null)
  const lastDoorJsonRef = useRef<Record<string, string>>({})
  const generationRef = useRef(0)
  const metaRef = useRef<OfflineReportRow | null>(null)

  const syncEngineRef = useRef<ReturnType<typeof createMaintenanceReportSyncEngine> | null>(null)

  const refreshPending = useCallback(async (rid: string) => {
    const rows = await idbListSyncQueueForReport(rid)
    const unsynced = rows.some(r => r.status === 'pending' || r.status === 'failed' || r.status === 'processing')
    hasPendingSyncRef.current = unsynced
    setHasPendingSync(unsynced)
    if (!unsynced && typeof navigator !== 'undefined' && navigator.onLine) {
      setSaveStatus(s => (s === 'syncing' ? 'synced' : s === 'saved_offline' ? 'synced' : s))
    }
  }, [])

  useEffect(() => {
    const engine = createMaintenanceReportSyncEngine({
      onSynced: rid => {
        if (rid === reportId) {
          setSaveStatus('synced')
          void refreshPending(rid)
        }
      },
      onConflict: (rid, message) => {
        if (rid === reportId) {
          setConflict({
            localRevisionAt: metaRef.current?.localRevisionAt ?? Date.now(),
            serverUpdatedAt: metaRef.current?.lastKnownServerUpdatedAt ?? '',
            message,
          })
          setSaveStatus('error')
        }
      },
      onError: rid => {
        if (rid === reportId) {
          setSaveStatus('error')
        }
      },
    })
    syncEngineRef.current = engine
    engine.start(14_000)
    return () => engine.stop()
  }, [reportId, refreshPending])

  useEffect(() => {
    if (!reportId) {
      setStatus('error')
      setSaveStatus('idle')
      return
    }

    const gen = ++generationRef.current
    setReportAuxFields({})

    ;(async () => {
      try {
        const [localMeta, localDoors] = await Promise.all([
          idbGetReport(reportId),
          idbGetDoorsForReport(reportId),
        ])

        let serverRes: Response | null = null
        try {
          serverRes = await fetch(`/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`, {
            cache: 'no-store',
          })
        } catch {
          serverRes = null
        }

        if (gen !== generationRef.current) return

        if (!serverRes?.ok) {
          if (localMeta && localDoors.length > 0) {
            const form = formFromLocalOnly(reportId, localMeta, localDoors)
            metaRef.current = localMeta
            setReportStatus('draft')
            setInitialForm(form)
            setStatus('ready')
            setSaveStatus('saved_offline')
            await refreshPending(reportId)
            return
          }
          setStatus('error')
          setSaveStatus('error')
          return
        }

        const data = (await serverRes.json()) as { report?: Record<string, unknown> | null }
        if (!data.report) {
          if (localMeta && localDoors.length > 0) {
            const form = formFromLocalOnly(reportId, localMeta, localDoors)
            metaRef.current = localMeta
            setReportStatus('draft')
            setInitialForm(form)
            setStatus('ready')
            setSaveStatus('saved_offline')
            await refreshPending(reportId)
            return
          }
          setStatus('error')
          setSaveStatus('error')
          return
        }

        const serverForm = mapDraftApiReportToForm(data.report)
        setReportStatus(String((data.report as { status?: string }).status ?? 'draft'))
        setReportAuxFields({
          client_name: (data.report as { client_name?: string }).client_name ?? '',
          client_location_name: (data.report as { client_location_name?: string }).client_location_name ?? '',
          ai_summary: (data.report as { ai_summary?: string | null }).ai_summary ?? null,
        })
        const serverUpdatedRaw = data.report.updated_at
        const serverMs = typeof serverUpdatedRaw === 'string' && serverUpdatedRaw
          ? Date.parse(serverUpdatedRaw)
          : 0

        const merged = mergeMaintenanceReportState({
          localReport: localMeta
            ? {
                header: localMeta.header,
                updatedAt: localMeta.updatedAt,
                localRevisionAt: localMeta.localRevisionAt,
              }
            : undefined,
          localDoors,
          serverForm,
          serverReportUpdatedMs: Number.isFinite(serverMs) ? serverMs : 0,
        })

        const lastKnown =
          typeof serverUpdatedRaw === 'string' && serverUpdatedRaw
            ? serverUpdatedRaw
            : localMeta?.lastKnownServerUpdatedAt ?? null

        merged.form.report_id = reportId
        const revision =
          localMeta?.localRevisionAt != null
            ? Math.max(localMeta.localRevisionAt, serverMs || 0)
            : Math.max(Date.now(), serverMs || 0)
        await persistMergedToIdb(reportId, merged.form, merged.doorUpdatedAt, lastKnown, revision)

        const nextMeta = await idbGetReport(reportId)
        metaRef.current = nextMeta ?? null

        setInitialForm(merged.form)
        setStatus('ready')
        setSaveStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'saved_offline')
        await refreshPending(reportId)
      } catch {
        if (gen !== generationRef.current) return
        setStatus('error')
        setSaveStatus('error')
      }
    })()
  }, [reportId, refreshPending])

  const flushPersist = useCallback(async () => {
    const form = pendingFormRef.current
    const rid = reportId
    if (!form || !rid) return

    setSaveStatus('saving_local')
    const existing = await idbGetReport(rid)
    const now = Date.now()
    const header = omitDoors(form)
    const nextMeta: OfflineReportRow = {
      reportId: rid,
      updatedAt: now,
      localRevisionAt: now,
      lastKnownServerUpdatedAt: existing?.lastKnownServerUpdatedAt ?? null,
      header: { ...header, report_id: rid },
    }
    await idbPutReport(nextMeta)
    metaRef.current = nextMeta

    for (const door of form.doors ?? []) {
      const json = JSON.stringify(door)
      const prev = lastDoorJsonRef.current[door.local_id]
      if (prev === json) continue
      lastDoorJsonRef.current[door.local_id] = json
      await idbPutDoor({
        id: door.local_id,
        reportId: rid,
        data: door,
        updatedAt: now,
      })
    }

    const payload = buildDraftPayload(form, 'draft', existing?.lastKnownServerUpdatedAt ?? null)
    const queueRow: SyncQueueRow = {
      id: stableQueueId(rid),
      reportId: rid,
      payload,
      status: 'pending',
      retryCount: 0,
      updatedAt: now,
    }
    await idbPutSyncQueue(queueRow)
    setSaveStatus('saved_offline')
    void refreshPending(rid)
    // Do not call syncEngine.tick() here — each flush + tick produced GET /draft probes; the engine interval + online handler runs sync.
  }, [reportId, refreshPending])

  const persistForm = useCallback(
    (form: MaintenanceFormValues) => {
      pendingFormRef.current = form
      // Avoid setState on every keystroke — if already saving locally, React bails (no parent re-render / watch churn).
      setSaveStatus(prev =>
        prev === 'saving_local' || prev === 'syncing' || prev === 'loading' ? prev : 'saving_local',
      )
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void flushPersist()
      }, PERSIST_DEBOUNCE_MS)

      if (versionTimer.current) clearTimeout(versionTimer.current)
      versionTimer.current = setTimeout(() => {
        if (reportId) {
          void idbPushReportVersion(reportId, form)
        }
      }, VERSION_DEBOUNCE_MS)
    },
    [flushPersist, reportId],
  )

  const syncNow = useCallback(async () => {
    await syncEngineRef.current?.tick()
  }, [])

  const resolveConflictRefresh = useCallback(async () => {
    if (!reportId) return
    setConflict(null)
    setStatus('loading')
    generationRef.current += 1
    try {
      const res = await fetch(`/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`, { cache: 'no-store' })
      const data = (await res.json()) as { report?: Record<string, unknown> | null }
      if (!data.report) {
        setStatus('error')
        return
      }
      const serverForm = mapDraftApiReportToForm(data.report)
      const serverUpdatedRaw = data.report.updated_at
      const lastKnown = typeof serverUpdatedRaw === 'string' ? serverUpdatedRaw : null
      const serverMs = serverUpdatedRaw ? Date.parse(String(serverUpdatedRaw)) : Date.now()
      const doorTimes: Record<string, number> = {}
      for (const d of serverForm.doors ?? []) {
        doorTimes[d.local_id] = serverMs
      }
      serverForm.report_id = reportId
      await persistMergedToIdb(reportId, serverForm, doorTimes, lastKnown, serverMs)
      metaRef.current = await idbGetReport(reportId) ?? null
      setReportStatus(String((data.report as { status?: string }).status ?? 'draft'))
      setReportAuxFields({
        client_name: (data.report as { client_name?: string }).client_name ?? '',
        client_location_name: (data.report as { client_location_name?: string }).client_location_name ?? '',
        ai_summary: (data.report as { ai_summary?: string | null }).ai_summary ?? null,
      })
      setInitialForm(serverForm)
      setStatus('ready')
      setSaveStatus('synced')
    } catch {
      setStatus('error')
    }
  }, [reportId])

  useEffect(() => {
    if (!reportId || status !== 'ready') return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingSyncRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [reportId, status])

  const initialReportRecord = useMemo(() => {
    if (!initialForm) return null
    return { ...(initialForm as unknown as Record<string, unknown>), ...reportAuxFields }
  }, [initialForm, reportAuxFields])

  return {
    status,
    reportStatus,
    saveStatus,
    initialForm,
    initialReportRecord,
    conflict,
    persistForm,
    flushPersist,
    syncNow,
    resolveConflictRefresh,
    hasPendingSync,
  }
}
