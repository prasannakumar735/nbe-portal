import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type { MaintenanceDoorForm, MaintenanceFormValues } from '@/lib/types/maintenance.types'

function createEmptyChecklist(): Record<string, 'good' | 'caution' | 'fault' | 'na' | null> {
  return MAINTENANCE_CHECKLIST_ITEMS.reduce(
    (acc, item) => {
      acc[item.code] = null
      return acc
    },
    {} as Record<string, 'good' | 'caution' | 'fault' | 'na' | null>,
  )
}

export function normalizeDoorFromApi(rawDoor: unknown, index: number): MaintenanceDoorForm {
  const source = (rawDoor && typeof rawDoor === 'object' ? rawDoor : {}) as Record<string, unknown>

  const checklist = createEmptyChecklist()
  const sourceChecklist = source.checklist
  if (sourceChecklist && typeof sourceChecklist === 'object' && !Array.isArray(sourceChecklist)) {
    Object.entries(sourceChecklist as Record<string, unknown>).forEach(([code, status]) => {
      if (status === 'good' || status === 'caution' || status === 'fault' || status === 'na') {
        checklist[code] = status
      }
    })
  }

  const photos = Array.isArray(source.photos)
    ? source.photos
        .map(photo => {
          if (!photo || typeof photo !== 'object') return null
          const item = photo as Record<string, unknown>
          const url = String(item.url ?? '').trim()
          const path = String(item.path ?? url).trim()
          if (!url) return null
          return { url, path: path || url }
        })
        .filter((photo): photo is { url: string; path: string } => Boolean(photo))
    : []

  const doorId = String(source.door_id ?? '').trim()
  const localId = String(source.local_id ?? '').trim()

  return {
    local_id: localId || crypto.randomUUID(),
    door_id: doorId || undefined,
    door_number: String(source.door_number ?? `Door ${index + 1}`).trim() || `Door ${index + 1}`,
    door_type: String(source.door_type ?? '').trim(),
    door_cycles: Number(source.door_cycles ?? 0) || 0,
    view_window_visibility: Number(source.view_window_visibility ?? 0) || 0,
    notes: String(source.notes ?? '').trim(),
    checklist,
    photos,
    isCollapsed: Boolean(source.isCollapsed ?? index > 0),
  }
}

/** Maps `/api/maintenance/draft` GET `report` object into `MaintenanceFormValues`. */
export function mapDraftApiReportToForm(report: Record<string, unknown>): MaintenanceFormValues {
  const maintenanceDoors: unknown[] = Array.isArray(report.doors) ? report.doors : []
  const doors = maintenanceDoors.map((door, index) => normalizeDoorFromApi(door, index))

  return {
    report_id: String(report.report_id ?? '').trim(),
    technician_name: String(report.technician_name ?? '').trim(),
    submission_date: String(report.submission_date ?? '').trim(),
    source_app: String(report.source_app ?? 'Portal').trim() || 'Portal',
    client_id: String(report.client_id ?? '').trim(),
    client_location_id: String(report.client_location_id ?? '').trim(),
    address: String(report.address ?? '').trim(),
    inspection_date: String(report.inspection_date ?? '').trim(),
    inspection_start: String(report.inspection_start ?? '').trim(),
    inspection_end: String(report.inspection_end ?? '').trim(),
    total_doors: Number(report.total_doors ?? doors.length) || doors.length || 1,
    notes: String(report.notes ?? '').trim(),
    signature_data_url: String(report.signature_data_url ?? '').trim(),
    signature_storage_url: String(report.signature_storage_url ?? '').trim(),
    doors: doors.length > 0 ? doors : [],
  }
}
