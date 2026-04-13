import type { MaintenanceDoorForm, MaintenanceFormValues } from '@/lib/types/maintenance.types'
import type { OfflineDoorRow, OfflineReportHeader } from '@/lib/types/offline-report.types'

function omitDoors(form: MaintenanceFormValues): OfflineReportHeader {
  const { doors: _d, ...rest } = form
  return rest
}

export type MergedMaintenanceReport = {
  form: MaintenanceFormValues
  doorUpdatedAt: Record<string, number>
}

/** Server timestamp for this payload (typically `maintenance_reports.updated_at`). */
export function mergeMaintenanceReportState(params: {
  localReport?: { header: OfflineReportHeader; updatedAt: number; localRevisionAt: number }
  localDoors: OfflineDoorRow[]
  serverForm: MaintenanceFormValues
  serverReportUpdatedMs: number
}): MergedMaintenanceReport {
  const { localReport, localDoors, serverForm, serverReportUpdatedMs } = params

  const localHeaderMs = localReport?.updatedAt ?? 0
  const header: OfflineReportHeader =
    localReport && localHeaderMs >= serverReportUpdatedMs
      ? { ...omitDoors(serverForm), ...localReport.header }
      : omitDoors(serverForm)

  const localById = new Map(localDoors.map(d => [d.id, d]))
  const serverDoors = serverForm.doors ?? []
  const serverByLocalId = new Map(serverDoors.map(d => [d.local_id, d]))

  const orderedLocalIds = localDoors.map(d => d.id)
  const serverOrderIds = serverDoors.map(d => d.local_id)

  const seen = new Set<string>()
  const mergedOrder: string[] = []

  for (const id of serverOrderIds) {
    if (!seen.has(id)) {
      seen.add(id)
      mergedOrder.push(id)
    }
  }
  for (const id of orderedLocalIds) {
    if (!seen.has(id)) {
      seen.add(id)
      mergedOrder.push(id)
    }
  }

  const mergedDoors: MaintenanceDoorForm[] = []
  const doorUpdatedAt: Record<string, number> = {}

  for (const id of mergedOrder) {
    const local = localById.get(id)
    const server = serverByLocalId.get(id)
    const picked = pickNewerDoor(local, server, serverReportUpdatedMs)
    mergedDoors.push(picked.door)
    doorUpdatedAt[picked.door.local_id] = picked.updatedAt
  }

  return {
    form: {
      ...header,
      report_id: header.report_id ?? serverForm.report_id,
      doors: mergedDoors.length > 0 ? mergedDoors : serverForm.doors?.length ? serverDoors : [],
    },
    doorUpdatedAt,
  }
}

function pickNewerDoor(
  local: OfflineDoorRow | undefined,
  server: MaintenanceDoorForm | undefined,
  serverReportUpdatedMs: number,
): { door: MaintenanceDoorForm; updatedAt: number } {
  if (!local && !server) {
    throw new Error('mergeMaintenanceReportState: empty door slot')
  }
  if (!local) {
    const door = server as MaintenanceDoorForm
    return { door, updatedAt: serverReportUpdatedMs }
  }
  if (!server) {
    return { door: local.data, updatedAt: local.updatedAt }
  }
  const localMs = local.updatedAt
  if (localMs >= serverReportUpdatedMs) {
    return { door: local.data, updatedAt: local.updatedAt }
  }
  return { door: server, updatedAt: serverReportUpdatedMs }
}
