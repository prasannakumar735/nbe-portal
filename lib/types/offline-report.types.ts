import type { MaintenanceDoorForm, MaintenanceFormValues } from '@/lib/types/maintenance.types'

/** Non-door fields persisted on the report row in IndexedDB. */
export type OfflineReportHeader = Omit<MaintenanceFormValues, 'doors'>

export type OfflineReportRow = {
  reportId: string
  updatedAt: number
  /** Last `maintenance_reports.updated_at` we successfully reconciled with (ISO). */
  lastKnownServerUpdatedAt: string | null
  /** Monotonic client clock for conflict checks; bumped on any local edit. */
  localRevisionAt: number
  header: OfflineReportHeader
}

export type OfflineDoorRow = {
  /** Stable client id (`local_id` on MaintenanceDoorForm). */
  id: string
  reportId: string
  data: MaintenanceDoorForm
  updatedAt: number
}

export type SyncQueueStatus = 'pending' | 'processing' | 'failed' | 'done'

export type SyncQueuePayload = {
  report_id: string
  status: 'draft' | 'submitted' | 'reviewing'
  form: MaintenanceFormValues
  /** Server `updated_at` we based this payload on (optimistic lock). */
  expectedServerUpdatedAt: string | null
}

export type SyncQueueRow = {
  id: string
  reportId: string
  payload: SyncQueuePayload
  status: SyncQueueStatus
  retryCount: number
  updatedAt: number
  lastError?: string
}

export type ReportVersionSnapshot = {
  id: string
  reportId: string
  savedAt: number
  form: MaintenanceFormValues
}

export type OfflineSaveUiStatus =
  | 'idle'
  | 'loading'
  | 'saving_local'
  | 'saved_offline'
  | 'syncing'
  | 'synced'
  | 'error'

export type OfflineConflictInfo = {
  localRevisionAt: number
  serverUpdatedAt: string
  message: string
}
