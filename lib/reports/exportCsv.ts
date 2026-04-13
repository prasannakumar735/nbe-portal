import type { ReportsFilterLabels, ReportsFilters } from '@/lib/reports/types'

/** Excel on Windows expects a UTF-8 BOM to open CSV as Unicode (avoids mojibake like "Â—"). */
export const CSV_UTF8_BOM = '\uFEFF'

export function withCsvUtf8Bom(content: string): string {
  return content.startsWith(CSV_UTF8_BOM) ? content : `${CSV_UTF8_BOM}${content}`
}

function escCell(v: string | number | boolean): string {
  const s = String(v ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const lines = [headers.map(escCell).join(','), ...rows.map(r => r.map(escCell).join(','))]
  return lines.join('\r\n')
}

function displayFilterValue(
  resolved: string | null | undefined,
  kind: 'client' | 'location' | 'technician' | 'job'
): string {
  const s = resolved?.trim()
  if (s) return s
  const fallbacks = {
    client: 'Unknown client',
    location: 'Unknown location',
    technician: 'Unknown technician',
    job: 'Unknown job type',
  }
  return fallbacks[kind]
}

export function filterSummaryLines(f: ReportsFilters, labels?: ReportsFilterLabels): string[] {
  const lines = [`Date range,${f.dateFrom} to ${f.dateTo}`]
  if (f.clientId) lines.push(`Client,${displayFilterValue(labels?.clientName, 'client')}`)
  if (f.locationId) lines.push(`Location,${displayFilterValue(labels?.locationName, 'location')}`)
  if (f.technicianId) lines.push(`Technician,${displayFilterValue(labels?.technicianName, 'technician')}`)
  if (f.workTypeLevel1Id) lines.push(`Job type,${displayFilterValue(labels?.workTypeName, 'job')}`)
  lines.push(`Billable,${f.billable}`)
  return lines
}

/** Label + value for HTML print and PDF filter blocks (avoids fragile comma splits). */
export function filterSummaryRows(f: ReportsFilters, labels?: ReportsFilterLabels): Array<[string, string]> {
  const rows: Array<[string, string]> = [['Date range', `${f.dateFrom} to ${f.dateTo}`]]
  if (f.clientId) rows.push(['Client', displayFilterValue(labels?.clientName, 'client')])
  if (f.locationId) rows.push(['Location', displayFilterValue(labels?.locationName, 'location')])
  if (f.technicianId) rows.push(['Technician', displayFilterValue(labels?.technicianName, 'technician')])
  if (f.workTypeLevel1Id) rows.push(['Job type', displayFilterValue(labels?.workTypeName, 'job')])
  rows.push(['Billable', f.billable])
  return rows
}
