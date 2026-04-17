import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import type { SyncQueuePayload, SyncQueueRow } from '@/lib/types/offline-report.types'
import {
  idbDeleteSyncQueueItem,
  idbGetReport,
  idbListSyncQueueByStatus,
  idbPutReport,
  idbPutSyncQueue,
} from '@/lib/offline/maintenance-report-idb'

const DRAFT_ENDPOINT = '/api/maintenance/draft'

type DraftGetReport = {
  report_id?: string
  updated_at?: string
  [key: string]: unknown
}

async function fetchDraftReport(reportId: string): Promise<{ updated_at: string | null } | null> {
  const res = await fetch(`${DRAFT_ENDPOINT}?reportId=${encodeURIComponent(reportId)}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as { report?: DraftGetReport | null }
  const r = data.report
  if (!r) return null
  const u = r.updated_at
  return { updated_at: typeof u === 'string' && u ? u : null }
}

function backoffMs(retryCount: number): number {
  const base = 800
  const cap = 60_000
  const exp = Math.min(cap, base * 2 ** Math.min(retryCount, 8))
  const jitter = Math.floor(Math.random() * 400)
  return exp + jitter
}

export async function processSyncQueueItem(row: SyncQueueRow): Promise<{ ok: true } | { ok: false; retryable: boolean; message: string }> {
  const { payload } = row
  const reportId = payload.report_id

  const serverProbe = await fetchDraftReport(reportId)
  if (!serverProbe?.updated_at) {
    return { ok: false, retryable: true, message: 'Server report unavailable' }
  }

  const existing = await idbGetReport(reportId)
  const expected = payload.expectedServerUpdatedAt
  if (expected && serverProbe.updated_at !== expected) {
    return {
      ok: false,
      retryable: false,
      message: 'Report was updated on the server. Refresh to merge changes before syncing.',
    }
  }

  const res = await fetch(DRAFT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report_id: reportId,
      status: payload.status,
      form: payload.form,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const retryable = res.status >= 500 || res.status === 429
    return { ok: false, retryable, message: errText || `HTTP ${res.status}` }
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const postUpdatedAt =
    body &&
    typeof body === 'object' &&
    typeof (body as { updated_at?: unknown }).updated_at === 'string' &&
    String((body as { updated_at: string }).updated_at).trim()
      ? String((body as { updated_at: string }).updated_at)
      : null

  const nextServerUpdatedAt = postUpdatedAt ?? (await fetchDraftReport(reportId))?.updated_at ?? serverProbe.updated_at

  if (existing) {
    await idbPutReport({
      ...existing,
      lastKnownServerUpdatedAt: nextServerUpdatedAt,
      updatedAt: Date.now(),
    })
  }

  return { ok: true }
}

export type SyncEngineOptions = {
  onSynced?: (reportId: string) => void
  onConflict?: (reportId: string, message: string) => void
  onError?: (reportId: string, message: string) => void
}

export function createMaintenanceReportSyncEngine(opts: SyncEngineOptions = {}) {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  const tick = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (running) return
    running = true
    try {
      const pendingRaw = [
        ...(await idbListSyncQueueByStatus('pending')),
        ...(await idbListSyncQueueByStatus('failed')),
      ]
      const byId = new Map<string, SyncQueueRow>()
      for (const row of pendingRaw) {
        byId.set(row.id, row)
      }
      const pending = [...byId.values()].sort((a, b) => a.updatedAt - b.updatedAt)

      for (const row of pending) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break

        const result = await processSyncQueueItem(row)
        if (result.ok) {
          await idbDeleteSyncQueueItem(row.id)
          opts.onSynced?.(row.reportId)
          continue
        }

        if (!result.retryable) {
          opts.onConflict?.(row.reportId, result.message)
          await idbDeleteSyncQueueItem(row.id)
          continue
        }

        opts.onError?.(row.reportId, result.message)
        const updated: SyncQueueRow = {
          ...row,
          status: 'pending',
          retryCount: row.retryCount + 1,
          updatedAt: Date.now(),
          lastError: result.message,
        }
        await idbPutSyncQueue(updated)
        await new Promise(r => setTimeout(r, backoffMs(updated.retryCount)))
      }
    } finally {
      running = false
    }
  }

  const start = (intervalMs = 12_000) => {
    if (timer) return
    void tick()
    timer = setInterval(() => void tick(), intervalMs)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', tick)
    }
  }

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', tick)
    }
  }

  return { tick, start, stop }
}

export function buildDraftPayload(
  form: MaintenanceFormValues,
  status: SyncQueuePayload['status'],
  expectedServerUpdatedAt: string | null,
): SyncQueuePayload {
  return {
    report_id: String(form.report_id ?? '').trim(),
    status,
    form,
    expectedServerUpdatedAt,
  }
}
