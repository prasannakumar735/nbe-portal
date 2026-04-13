import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'

/** Maps GET-draft-shaped payload to MaintenanceFormValues for PDF generation. */
export function draftPayloadToFormValues(report: Record<string, unknown>): MaintenanceFormValues {
  return {
    report_id: report.report_id as string | undefined,
    offline_id: report.offline_id as string | undefined,
    technician_name: String(report.technician_name ?? ''),
    submission_date: String(report.submission_date ?? ''),
    source_app: String(report.source_app ?? 'Portal'),
    client_id: String(report.client_id ?? ''),
    client_location_id: String(report.client_location_id ?? ''),
    address: String(report.address ?? ''),
    inspection_date: String(report.inspection_date ?? ''),
    inspection_start: String(report.inspection_start ?? ''),
    inspection_end: String(report.inspection_end ?? ''),
    total_doors: Number(report.total_doors ?? 1),
    notes: String(report.notes ?? ''),
    signature_data_url: String(report.signature_data_url ?? ''),
    signature_storage_url: String(report.signature_storage_url ?? ''),
    doors: Array.isArray(report.doors) ? (report.doors as MaintenanceFormValues['doors']) : [],
  }
}
