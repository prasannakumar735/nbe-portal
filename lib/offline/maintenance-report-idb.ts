import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import type {
  OfflineDoorRow,
  OfflineReportRow,
  ReportVersionSnapshot,
  SyncQueueRow,
  SyncQueueStatus,
} from '@/lib/types/offline-report.types'

const DB_NAME = 'nbe-maintenance-report-sync'
const DB_VERSION = 1

type MaintenanceReportDb = DBSchema & {
  reports: {
    key: string
    value: OfflineReportRow
  }
  doors: {
    key: [string, string]
    value: OfflineDoorRow
    indexes: { 'by-report': string }
  }
  sync_queue: {
    key: string
    value: SyncQueueRow
    indexes: { 'by-report': string; 'by-status': SyncQueueStatus }
  }
  report_versions: {
    key: string
    value: ReportVersionSnapshot
    indexes: { 'by-report': string; 'by-saved': number }
  }
}

let dbPromise: Promise<IDBPDatabase<MaintenanceReportDb>> | null = null

export function getMaintenanceReportDB(): Promise<IDBPDatabase<MaintenanceReportDb>> {
  if (!dbPromise) {
    dbPromise = openDB<MaintenanceReportDb>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('reports')) {
          database.createObjectStore('reports', { keyPath: 'reportId' })
        }
        if (!database.objectStoreNames.contains('doors')) {
          const doors = database.createObjectStore('doors', { keyPath: ['id', 'reportId'] })
          doors.createIndex('by-report', 'reportId')
        }
        if (!database.objectStoreNames.contains('sync_queue')) {
          const q = database.createObjectStore('sync_queue', { keyPath: 'id' })
          q.createIndex('by-report', 'reportId')
          q.createIndex('by-status', 'status')
        }
        if (!database.objectStoreNames.contains('report_versions')) {
          const v = database.createObjectStore('report_versions', { keyPath: 'id' })
          v.createIndex('by-report', 'reportId')
          v.createIndex('by-saved', 'savedAt')
        }
      },
    })
  }
  return dbPromise
}

export async function idbGetReport(reportId: string): Promise<OfflineReportRow | undefined> {
  const db = await getMaintenanceReportDB()
  return db.get('reports', reportId)
}

export async function idbPutReport(row: OfflineReportRow): Promise<void> {
  const db = await getMaintenanceReportDB()
  await db.put('reports', row)
}

export async function idbDeleteReportCascade(reportId: string): Promise<void> {
  const db = await getMaintenanceReportDB()
  const doors = await idbGetDoorsForReport(reportId)
  const tx = db.transaction(['reports', 'doors', 'sync_queue', 'report_versions'], 'readwrite')
  await tx.objectStore('reports').delete(reportId)
  const doorStore = tx.objectStore('doors')
  for (const row of doors) {
    await doorStore.delete([row.id, reportId])
  }
  const qStore = tx.objectStore('sync_queue')
  const queueRows = await db.getAllFromIndex('sync_queue', 'by-report', reportId)
  for (const q of queueRows) {
    await qStore.delete(q.id)
  }
  const vStore = tx.objectStore('report_versions')
  const versions = await db.getAllFromIndex('report_versions', 'by-report', reportId)
  for (const v of versions) {
    await vStore.delete(v.id)
  }
  await tx.done
}

export async function idbGetDoorsForReport(reportId: string): Promise<OfflineDoorRow[]> {
  const db = await getMaintenanceReportDB()
  const list = await db.getAllFromIndex('doors', 'by-report', reportId)
  return list ?? []
}

export async function idbPutDoor(row: OfflineDoorRow): Promise<void> {
  const db = await getMaintenanceReportDB()
  await db.put('doors', row)
}

export async function idbDeleteDoor(reportId: string, doorLocalId: string): Promise<void> {
  const db = await getMaintenanceReportDB()
  await db.delete('doors', [doorLocalId, reportId])
}

export async function idbPutSyncQueue(row: SyncQueueRow): Promise<void> {
  const db = await getMaintenanceReportDB()
  await db.put('sync_queue', row)
}

export async function idbEnqueueSync(row: SyncQueueRow): Promise<void> {
  await idbPutSyncQueue(row)
}

export async function idbGetSyncQueueItem(id: string): Promise<SyncQueueRow | undefined> {
  const db = await getMaintenanceReportDB()
  return db.get('sync_queue', id)
}

export async function idbListSyncQueueByStatus(status: SyncQueueStatus): Promise<SyncQueueRow[]> {
  const db = await getMaintenanceReportDB()
  return db.getAllFromIndex('sync_queue', 'by-status', status)
}

export async function idbListSyncQueueForReport(reportId: string): Promise<SyncQueueRow[]> {
  const db = await getMaintenanceReportDB()
  return db.getAllFromIndex('sync_queue', 'by-report', reportId)
}

export async function idbDeleteSyncQueueItem(id: string): Promise<void> {
  const db = await getMaintenanceReportDB()
  await db.delete('sync_queue', id)
}

const MAX_VERSIONS = 3

export async function idbPushReportVersion(reportId: string, form: MaintenanceFormValues): Promise<void> {
  const db = await getMaintenanceReportDB()
  const id = crypto.randomUUID()
  const row: ReportVersionSnapshot = {
    id,
    reportId,
    savedAt: Date.now(),
    form: structuredClone(form),
  }
  await db.put('report_versions', row)

  const all = await db.getAllFromIndex('report_versions', 'by-report', reportId)
  const sorted = [...all].sort((a, b) => b.savedAt - a.savedAt)
  const toRemove = sorted.slice(MAX_VERSIONS)
  for (const snap of toRemove) {
    await db.delete('report_versions', snap.id)
  }
}

export async function idbListReportVersions(reportId: string): Promise<ReportVersionSnapshot[]> {
  const db = await getMaintenanceReportDB()
  const all = await db.getAllFromIndex('report_versions', 'by-report', reportId)
  return [...all].sort((a, b) => b.savedAt - a.savedAt)
}

export async function idbHasUnsyncedWork(reportId: string): Promise<boolean> {
  const pending = await idbListSyncQueueForReport(reportId)
  return pending.some(r => r.status === 'pending' || r.status === 'failed' || r.status === 'processing')
}

/** True if any queue row is pending/failed across all reports (beforeunload). */
export async function idbAnyPendingSync(): Promise<boolean> {
  const db = await getMaintenanceReportDB()
  const [a, b] = await Promise.all([
    db.getAllFromIndex('sync_queue', 'by-status', 'pending'),
    db.getAllFromIndex('sync_queue', 'by-status', 'failed'),
  ])
  return (a.length + b.length) > 0
}
