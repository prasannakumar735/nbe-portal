import type { ManagerAttendanceRow } from '@/lib/officeClock/fetchManagerAttendance'
import { rowsToCsv, withCsvUtf8Bom } from '@/lib/reports/exportCsv'

export function buildAttendanceCsv(rows: ManagerAttendanceRow[]): string {
  const headers = [
    'employee',
    'date',
    'sign_in',
    'sign_out',
    'duration',
    'duration_hours',
    'site',
    'status',
  ]
  const data = rows.map(r => [
    r.employeeName,
    r.dateMelbourne,
    r.signInMelbourne,
    r.signOutMelbourne ?? '',
    r.durationDisplay ?? '',
    r.durationHours != null ? String(r.durationHours) : '',
    r.siteName,
    r.status === 'open'
      ? 'Signed in'
      : r.status === 'system_logged_out'
        ? 'System logged out'
        : 'Closed',
  ])
  return rowsToCsv(headers, data)
}

export function downloadAttendanceCsv(filename: string, rows: ManagerAttendanceRow[]) {
  const csv = buildAttendanceCsv(rows)
  const blob = new Blob([withCsvUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
