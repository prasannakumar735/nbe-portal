import type { BillableFilter, ReportsFilters, ReportsTab, TimecardGroupBy } from '@/lib/reports/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function mondayOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const offset = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + offset)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Current ISO week (Mon–Sun) in local time */
export function presetThisWeek(): { from: string; to: string } {
  const mon = mondayOfWeek(new Date())
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: toIsoDate(mon), to: toIsoDate(sun) }
}

/** Previous calendar month */
export function presetLastMonth(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: toIsoDate(first), to: toIsoDate(last) }
}

function defaultRange(): { from: string; to: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return { from: toIsoDate(start), to: toIsoDate(end) }
}

function parseDate(s: string | undefined | null): string | null {
  if (!s || typeof s !== 'string') return null
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(s.trim())
  return m ? m[1] : null
}

export function parseBillable(v: string | null | undefined): BillableFilter {
  if (v === 'yes' || v === 'no') return v
  return 'all'
}

/** PostgREST rejects invalid UUIDs in `.eq()` — ignore bad URL params */
function optionalUuid(v: string | undefined | null): string | null {
  const s = v?.trim()
  if (!s) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s
  return null
}

export function parseFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>
): ReportsFilters {
  const g = (k: string): string | undefined => {
    const v = sp[k]
    if (Array.isArray(v)) return v[0]
    return v
  }

  const defaults = defaultRange()
  const from = parseDate(g('from')) ?? defaults.from
  const to = parseDate(g('to')) ?? defaults.to

  let dateFrom = from
  let dateTo = to
  if (dateFrom > dateTo) {
    ;[dateFrom, dateTo] = [dateTo, dateFrom]
  }

  return {
    dateFrom,
    dateTo,
    clientId: optionalUuid(g('client')),
    technicianId: optionalUuid(g('tech')),
    workTypeLevel1Id: optionalUuid(g('jobType')),
    billable: parseBillable(g('billable')),
    locationId: optionalUuid(g('location')),
  }
}

export function parseGroupBy(v: string | null | undefined): TimecardGroupBy {
  if (v === 'technician' || v === 'client' || v === 'day') return v
  return 'day'
}

export function filtersToQueryString(f: ReportsFilters): string {
  const p = new URLSearchParams()
  p.set('from', f.dateFrom)
  p.set('to', f.dateTo)
  if (f.clientId) p.set('client', f.clientId)
  if (f.technicianId) p.set('tech', f.technicianId)
  if (f.workTypeLevel1Id) p.set('jobType', f.workTypeLevel1Id)
  if (f.billable !== 'all') p.set('billable', f.billable)
  if (f.locationId) p.set('location', f.locationId)
  return p.toString()
}

export function parseTab(v: string | null | undefined): ReportsTab {
  if (v === 'maintenance' || v === 'gps' || v === 'quotes' || v === 'timecards') return v
  return 'timecards'
}

export function buildReportsHref(
  basePath: string,
  f: ReportsFilters,
  tab: ReportsTab,
  extra?: { group?: TimecardGroupBy }
): string {
  const p = new URLSearchParams(filtersToQueryString(f))
  p.set('tab', tab)
  if (extra?.group && tab === 'timecards') p.set('group', extra.group)
  return `${basePath}?${p.toString()}`
}
