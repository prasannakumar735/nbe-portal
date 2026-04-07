import { openDB, type DBSchema } from 'idb'
import type { MaintenanceFormValues, ClientOption, ClientLocationOption } from '@/lib/types/maintenance.types'

export type OfflineInspectionStatus = 'pending' | 'synced' | 'syncing'

export type OfflineInspectionRecord = {
  id: string
  report_data: MaintenanceFormValues
  status: OfflineInspectionStatus
  created_at: number
  updated_at: number
  attempt_count?: number
  last_attempt_at?: number
  last_error?: string
}

type OfflineDbSchema = DBSchema & {
  offline_inspections: {
    key: string
    value: OfflineInspectionRecord
    indexes: { 'by-status': OfflineInspectionStatus; 'by-created_at': number }
  }
  offline_meta: {
    key: string
    value: { key: string; updated_at: number; value: unknown }
    indexes: { 'by-updated_at': number }
  }
  offline_doors: {
    key: string
    value: { key: string; updated_at: number; doors: Array<{ id: string; door_label: string; door_type: string }> }
    indexes: { 'by-updated_at': number }
  }
}

const DB_NAME = 'nbe-offline'
const DB_VERSION = 4

async function getDb() {
  return openDB<OfflineDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('offline_inspections', { keyPath: 'id' })
        store.createIndex('by-status', 'status')
        store.createIndex('by-created_at', 'created_at')
      }

      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('offline_meta')) {
          const meta = db.createObjectStore('offline_meta', { keyPath: 'key' })
          meta.createIndex('by-updated_at', 'updated_at')
        }
      }

      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('offline_doors')) {
          const store = db.createObjectStore('offline_doors', { keyPath: 'key' })
          store.createIndex('by-updated_at', 'updated_at')
        }
      }
    },
  })
}

export async function offlineAddInspection(report_data: MaintenanceFormValues): Promise<string> {
  const db = await getDb()
  const id = crypto.randomUUID()
  const now = Date.now()
  const enriched: MaintenanceFormValues = {
    ...report_data,
    offline_id: report_data.offline_id || id,
  }
  const record: OfflineInspectionRecord = {
    id,
    report_data: enriched,
    status: 'pending',
    created_at: now,
    updated_at: now,
    attempt_count: 0,
  }
  await db.put('offline_inspections', record)
  return id
}

export async function offlineListAll(): Promise<OfflineInspectionRecord[]> {
  const db = await getDb()
  const items = await db.getAll('offline_inspections')
  return (items ?? []).sort((a, b) => b.created_at - a.created_at)
}

export async function offlineListPending(): Promise<OfflineInspectionRecord[]> {
  const db = await getDb()
  const items = await db.getAllFromIndex('offline_inspections', 'by-status', 'pending')
  return (items ?? []).sort((a, b) => a.created_at - b.created_at)
}

export async function offlineCountPending(): Promise<number> {
  const db = await getDb()
  const keys = await db.getAllKeysFromIndex('offline_inspections', 'by-status', 'pending')
  return keys?.length ?? 0
}

export async function offlineSetStatus(id: string, status: OfflineInspectionStatus): Promise<void> {
  const db = await getDb()
  const existing = await db.get('offline_inspections', id)
  if (!existing) return
  await db.put('offline_inspections', { ...existing, status, updated_at: Date.now() })
}

export async function offlineMarkAttempt(id: string, patch?: { error?: string | null }): Promise<void> {
  const db = await getDb()
  const existing = await db.get('offline_inspections', id)
  if (!existing) return
  const attempt = Number(existing.attempt_count ?? 0) + 1
  await db.put('offline_inspections', {
    ...existing,
    attempt_count: attempt,
    last_attempt_at: Date.now(),
    last_error: patch?.error ?? existing.last_error,
    updated_at: Date.now(),
  })
}

export async function offlineDelete(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('offline_inspections', id)
}

export async function offlineGet(id: string): Promise<OfflineInspectionRecord | null> {
  const db = await getDb()
  return (await db.get('offline_inspections', id)) ?? null
}

type MetaKey = 'clients' | `locations:${string}` | 'last_selection'

async function metaPut(key: MetaKey, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('offline_meta', { key, updated_at: Date.now(), value })
}

async function metaGet<T>(key: MetaKey): Promise<T | null> {
  const db = await getDb()
  const row = await db.get('offline_meta', key)
  return (row?.value as T) ?? null
}

export async function offlineCacheClients(clients: ClientOption[]): Promise<void> {
  await metaPut('clients', clients)
}

export async function offlineGetCachedClients(): Promise<ClientOption[] | null> {
  return metaGet<ClientOption[]>('clients')
}

export async function offlineCacheLocations(clientId: string, locations: ClientLocationOption[]): Promise<void> {
  await metaPut(`locations:${clientId}`, locations)
}

export async function offlineGetCachedLocations(clientId: string): Promise<ClientLocationOption[] | null> {
  return metaGet<ClientLocationOption[]>(`locations:${clientId}`)
}

export async function offlineSetLastSelection(selection: {
  client_id?: string
  client_location_id?: string
}): Promise<void> {
  await metaPut('last_selection', {
    client_id: String(selection.client_id ?? '').trim(),
    client_location_id: String(selection.client_location_id ?? '').trim(),
  })
}

export async function offlineGetLastSelection(): Promise<{ client_id: string; client_location_id: string } | null> {
  return metaGet<{ client_id: string; client_location_id: string }>('last_selection')
}

export async function offlineCacheDoors(
  locationId: string,
  doors: Array<{ id: string; door_label: string; door_type: string }>
): Promise<void> {
  const db = await getDb()
  await db.put('offline_doors', { key: locationId, updated_at: Date.now(), doors })
}

export async function offlineGetCachedDoors(
  locationId: string
): Promise<{ doors: Array<{ id: string; door_label: string; door_type: string }>; updated_at: number } | null> {
  const db = await getDb()
  const row = await db.get('offline_doors', locationId)
  if (!row) return null
  return { doors: row.doors ?? [], updated_at: row.updated_at }
}

