import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { formatLocationForExport } from '@/lib/timecard/formatLocation'
import { withCsvUtf8Bom } from '@/lib/reports/exportCsv'

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildTimesheetCsv(
  entries: EmployeeTimesheetEntry[],
  lookups: {
    clientName: (id: string | null) => string
    locationName: (id: string | null) => string
    workTypeLabel: (l1: string | null, l2: string | null) => string
  },
): string {
  const headers = [
    'date',
    'client',
    'location',
    'work_type',
    'task',
    'start_time',
    'end_time',
    'break_minutes',
    'total_hours',
    'billable',
    'notes',
    'location',
  ]
  const lines = [headers.join(',')]
  for (const e of entries) {
    const row = [
      e.entry_date,
      lookups.clientName(e.client_id),
      lookups.locationName(e.location_id),
      lookups.workTypeLabel(e.work_type_level1_id, e.work_type_level2_id),
      e.task,
      e.start_time,
      e.end_time,
      String(e.break_minutes),
      String(e.total_hours),
      e.billable ? 'yes' : 'no',
      e.notes,
      formatLocationForExport(e.gps_start_address, e.gps_end_address, e.gps_start, e.gps_end),
    ].map(c => csvEscape(String(c)))
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function downloadTimesheetCsv(filename: string, csv: string) {
  const blob = new Blob([withCsvUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
