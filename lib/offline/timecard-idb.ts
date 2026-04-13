import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EmployeeTimesheetEntry, EmployeeWeeklyTimesheet } from '@/lib/types/employee-timesheet.types'

const DB_NAME = 'nbe-timecard-offline'
const DB_VERSION = 1

export type TimecardWeekMetaRow = {
  key: string
  userId: string
  weekStart: string
  timesheet: EmployeeWeeklyTimesheet | null
  updatedAt: number
}

export type TimecardEntryRow = {
  id: string
  weekKey: string
  data: EmployeeTimesheetEntry
  updatedAt: number
}

export type TimecardSyncQueueRow = {
  id: string
  weekKey: string
  userId: string
  payloadJson: string
  status: 'pending' | 'failed'
  retryCount: number
  updatedAt: number
}

type Schema = DBSchema & {
  week_meta: {
    key: string
    value: TimecardWeekMetaRow
  }
  entries: {
    key: string
    value: TimecardEntryRow
    indexes: { 'by-week': string }
  }
  sync_queue: {
    key: string
    value: TimecardSyncQueueRow
  }
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null

export function getTimecardDB() {
  if (!dbp) {
    dbp = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('week_meta')) {
          db.createObjectStore('week_meta', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('entries')) {
          const e = db.createObjectStore('entries', { keyPath: 'id' })
          e.createIndex('by-week', 'weekKey')
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' })
        }
      },
    })
  }
  return dbp
}

export function weekKey(userId: string, weekStart: string): string {
  return `${userId}::${weekStart}`
}

export async function idbGetWeekMeta(key: string): Promise<TimecardWeekMetaRow | undefined> {
  const db = await getTimecardDB()
  return db.get('week_meta', key)
}

export async function idbPutWeekMeta(row: TimecardWeekMetaRow): Promise<void> {
  const db = await getTimecardDB()
  await db.put('week_meta', row)
}

export async function idbGetEntriesForWeek(weekKey: string): Promise<TimecardEntryRow[]> {
  const db = await getTimecardDB()
  return db.getAllFromIndex('entries', 'by-week', weekKey)
}

export async function idbPutEntry(row: TimecardEntryRow): Promise<void> {
  const db = await getTimecardDB()
  await db.put('entries', row)
}

export async function idbDeleteEntry(id: string): Promise<void> {
  const db = await getTimecardDB()
  await db.delete('entries', id)
}

export async function idbReplaceWeekEntries(weekKey: string, rows: TimecardEntryRow[]): Promise<void> {
  const db = await getTimecardDB()
  const existing = await db.getAllFromIndex('entries', 'by-week', weekKey)
  const tx = db.transaction('entries', 'readwrite')
  const store = tx.objectStore('entries')
  for (const r of existing) {
    await store.delete(r.id)
  }
  for (const r of rows) {
    await store.put(r)
  }
  await tx.done
}

export async function idbEnqueueSync(row: TimecardSyncQueueRow): Promise<void> {
  const db = await getTimecardDB()
  await db.put('sync_queue', row)
}

export async function idbGetSync(id: string): Promise<TimecardSyncQueueRow | undefined> {
  const db = await getTimecardDB()
  return db.get('sync_queue', id)
}

export async function idbDeleteSync(id: string): Promise<void> {
  const db = await getTimecardDB()
  await db.delete('sync_queue', id)
}

export async function idbListPendingSyncs(): Promise<TimecardSyncQueueRow[]> {
  const db = await getTimecardDB()
  return db.getAll('sync_queue')
}
