import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeGpsPointFromRow } from '@/lib/timecard/gpsDbColumns'
import { getErrorMessage, toThrownError } from '@/lib/reports/errorMessage'
import type {
  FilterOptions,
  GpsReportRow,
  MaintenanceReportRow,
  QuotePvcLine,
  QuoteServiceLine,
  QuoteTrendRow,
  QuotesReportSummary,
  ReportsFilterLabels,
  ReportsFilters,
  ReportsSummary,
  TimecardGroupBy,
  TimecardGroupedResponse,
  TimecardReportRow,
} from '@/lib/reports/types'

/** Match maintenance/clients API: many rows use `client_name` as the primary label */
function clientDisplayName(c: {
  id?: string | null
  name?: string | null
  client_name?: string | null
  company_name?: string | null
}) {
  const s = String(c.client_name ?? c.name ?? c.company_name ?? '').trim()
  if (s) return s
  if (c.id) return `Client ${String(c.id).slice(0, 8)}…`
  return '—'
}

function locationDisplayName(l: {
  id?: string | null
  location_name?: string | null
  name?: string | null
  suburb?: string | null
  site_name?: string | null
}) {
  const s = String(l.location_name ?? l.name ?? l.site_name ?? l.suburb ?? '').trim()
  if (s) return s
  if (l.id) return `Location ${String(l.id).slice(0, 8)}…`
  return '—'
}

function profileName(p: { full_name?: string | null; first_name?: string | null; last_name?: string | null }) {
  const fn = (p.full_name ?? '').trim()
  if (fn) return fn
  const a = (p.first_name ?? '').trim()
  const b = (p.last_name ?? '').trim()
  return [a, b].filter(Boolean).join(' ') || '—'
}

async function loadProfilesMap(supabase: SupabaseClient, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return new Map<string, string>()
  const { data, error } = await supabase.from('profiles').select('id, full_name, first_name, last_name').in('id', uniq)
  if (error) throw error
  const m = new Map<string, string>()
  ;(data ?? []).forEach(p => m.set(String(p.id), profileName(p as Parameters<typeof profileName>[0])))
  return m
}

async function loadClientsMap(supabase: SupabaseClient, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return new Map<string, string>()
  /** `select('*')` avoids PostgREST errors when optional columns (e.g. client_name) differ per schema. */
  const { data, error } = await supabase.from('clients').select('*').in('id', uniq)
  if (error) throw error
  const m = new Map<string, string>()
  ;(data ?? []).forEach(c => m.set(String((c as { id: string }).id), clientDisplayName(c as Parameters<typeof clientDisplayName>[0])))
  return m
}

async function loadLocationsMap(supabase: SupabaseClient, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return new Map<string, { label: string; client_id: string | null }>()
  const { data, error } = await supabase.from('client_locations').select('*').in('id', uniq)
  if (error) throw error
  const m = new Map<string, { label: string; client_id: string | null }>()
  ;(data ?? []).forEach(l => {
    const row = l as Record<string, unknown>
    m.set(String(row.id), {
      label: locationDisplayName(l as Parameters<typeof locationDisplayName>[0]),
      client_id: row.client_id ? String(row.client_id) : null,
    })
  })
  return m
}

/** Merge lookup maps when RLS returns partial rows; fill gaps with service role if configured. */
async function mapWithServiceRoleFallback<T>(
  load: (sb: SupabaseClient, keys: string[]) => Promise<Map<string, T>>,
  supabase: SupabaseClient,
  keys: string[]
): Promise<Map<string, T>> {
  const uniq = [...new Set(keys.filter(Boolean))]
  if (uniq.length === 0) return new Map()
  let primary: Map<string, T>
  try {
    primary = await load(supabase, uniq)
  } catch {
    primary = new Map()
  }
  const missing = uniq.filter(k => !primary.has(k))
  if (missing.length === 0) return primary
  try {
    const { createServiceRoleClient } = await import('@/lib/supabase/serviceRole')
    const admin = createServiceRoleClient()
    let extra: Map<string, T>
    try {
      extra = await load(admin, missing)
    } catch {
      extra = new Map()
    }
    const merged = new Map(primary)
    extra.forEach((v, k) => merged.set(k, v))
    return merged
  } catch {
    return primary
  }
}

async function loadWorkTypeLabels(
  supabase: SupabaseClient,
  l1Ids: (string | null)[],
  l2Ids: (string | null)[]
) {
  const u1 = [...new Set(l1Ids.filter(Boolean) as string[])]
  const u2 = [...new Set(l2Ids.filter(Boolean) as string[])]
  const l1 = new Map<string, string>()
  const l2 = new Map<string, string>()
  if (u1.length) {
    const { data, error } = await supabase.from('work_type_level1').select('id, code, name').in('id', u1)
    if (error) throw error
    ;(data ?? []).forEach(r => {
      const row = r as { id: string; code?: string; name?: string }
      l1.set(row.id, [row.code, row.name].filter(Boolean).join(' · ') || row.id)
    })
  }
  if (u2.length) {
    const { data, error } = await supabase.from('work_type_level2').select('id, code, name').in('id', u2)
    if (!error && data) {
      ;(data as { id: string; code?: string; name?: string }[]).forEach(row => {
        l2.set(row.id, [row.code, row.name].filter(Boolean).join(' · ') || row.id)
      })
    }
  }
  return { l1, l2 }
}

/** Resolve filter UUIDs to display names for PDF/CSV/print headers (avoids raw ids in exports). */
export async function resolveReportsFilterLabels(
  supabase: SupabaseClient,
  filters: ReportsFilters
): Promise<ReportsFilterLabels> {
  const clientId = filters.clientId
  const locationId = filters.locationId
  const technicianId = filters.technicianId
  const wt1Id = filters.workTypeLevel1Id

  const [clientMap, locMap, profiles, wt] = await Promise.all([
    clientId ? mapWithServiceRoleFallback(loadClientsMap, supabase, [clientId]) : Promise.resolve(new Map<string, string>()),
    locationId
      ? mapWithServiceRoleFallback(loadLocationsMap, supabase, [locationId])
      : Promise.resolve(new Map<string, { label: string; client_id: string | null }>()),
    technicianId ? loadProfilesMap(supabase, [technicianId]) : Promise.resolve(new Map<string, string>()),
    wt1Id ? loadWorkTypeLabels(supabase, [wt1Id], []) : Promise.resolve({ l1: new Map<string, string>(), l2: new Map<string, string>() }),
  ])

  return {
    clientName: clientId ? clientMap.get(clientId) ?? null : null,
    locationName: locationId ? locMap.get(locationId)?.label ?? null : null,
    technicianName: technicianId ? profiles.get(technicianId) ?? null : null,
    workTypeName: wt1Id ? wt.l1.get(wt1Id) ?? null : null,
  }
}

function applyBillableFilter<T extends { billable: boolean }>(rows: T[], billable: ReportsFilters['billable']): T[] {
  if (billable === 'yes') return rows.filter(r => r.billable)
  if (billable === 'no') return rows.filter(r => !r.billable)
  return rows
}

export async function fetchFilterOptions(supabase: SupabaseClient): Promise<FilterOptions> {
  const empty: FilterOptions = {
    clients: [],
    technicians: [],
    locations: [],
    workTypesLevel1: [],
  }

  /** Anyone who may appear on timesheets (excludes portal-only client users). */
  const staffRoles = ['technician', 'employee', 'manager', 'admin'] as const

  const [clientsRes, profilesRes, locRes, wtRes] = await Promise.all([
    supabase.from('clients').select('*').order('id'),
    supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, role')
      .in('role', [...staffRoles])
      .order('id'),
    supabase.from('client_locations').select('*').order('id'),
    supabase.from('work_type_level1').select('id, code, name').order('code'),
  ])

  if (clientsRes.error) {
    console.warn('[fetchFilterOptions] clients:', getErrorMessage(clientsRes.error))
  }
  if (profilesRes.error) {
    console.warn('[fetchFilterOptions] profiles:', getErrorMessage(profilesRes.error))
  }
  if (locRes.error) {
    console.warn('[fetchFilterOptions] client_locations:', getErrorMessage(locRes.error))
  }
  if (wtRes.error) {
    console.warn('[fetchFilterOptions] work_type_level1:', getErrorMessage(wtRes.error))
  }

  const clients = (clientsRes.data ?? []).map(c => ({
    id: String(c.id),
    name: clientDisplayName(c as Parameters<typeof clientDisplayName>[0]),
  }))

  const technicians = (profilesRes.data ?? []).map(p => ({
    id: String(p.id),
    name: profileName(p as Parameters<typeof profileName>[0]),
  }))

  const locations = (locRes.data ?? []).map(l => ({
    id: String((l as { id: string }).id),
    client_id: (l as { client_id?: string }).client_id ? String((l as { client_id: string }).client_id) : null,
    label: locationDisplayName(l as Parameters<typeof locationDisplayName>[0]),
  }))

  const workTypesLevel1 = (wtRes.data ?? []).map(w => ({
    id: String((w as { id: string }).id),
    code: String((w as { code?: string }).code ?? ''),
    name: String((w as { name?: string }).name ?? ''),
  }))

  return {
    clients: clientsRes.error ? empty.clients : clients,
    technicians: profilesRes.error ? empty.technicians : technicians,
    locations: locRes.error ? empty.locations : locations,
    workTypesLevel1: wtRes.error ? empty.workTypesLevel1 : workTypesLevel1,
  }
}

/**
 * Manager reports filters need the full client/site lists. Row-level security on `clients` /
 * `client_locations` often returns zero rows for a normal JWT, which leaves dropdowns empty.
 * When `SUPABASE_SERVICE_ROLE_KEY` is set, use the service client so options match operational data.
 */
export async function fetchFilterOptionsForPrivilegedReport(
  userSupabase: SupabaseClient
): Promise<FilterOptions> {
  try {
    const { createServiceRoleClient, getSupabaseUrlForServer } = await import('@/lib/supabase/serviceRole')
    const hasUrl = Boolean(getSupabaseUrlForServer())
    const hasKey = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
    if (!hasUrl || !hasKey) {
      console.warn(
        '[fetchFilterOptionsForPrivilegedReport] missing server URL or SUPABASE_SERVICE_ROLE_KEY; using user JWT (dropdowns may be empty if RLS blocks clients/client_locations).'
      )
      return fetchFilterOptions(userSupabase)
    }
    const admin = createServiceRoleClient()
    return await fetchFilterOptions(admin)
  } catch (e) {
    console.warn('[fetchFilterOptionsForPrivilegedReport] falling back to user client:', getErrorMessage(e))
    return fetchFilterOptions(userSupabase)
  }
}

/**
 * Distinct L1 work types that appear on timesheet lines in the date range for the given client + site.
 * Used for cascading Job type filter (options must match real data).
 */
export async function fetchWorkTypesLevel1ForScope(
  supabase: SupabaseClient,
  range: { dateFrom: string; dateTo: string },
  scope: { clientId: string; locationId: string }
): Promise<Array<{ id: string; code: string; name: string }>> {
  const { data: rows, error } = await supabase
    .from('employee_timesheet_entries')
    .select('work_type_level1_id')
    .gte('entry_date', range.dateFrom)
    .lte('entry_date', range.dateTo)
    .eq('client_id', scope.clientId)
    .eq('location_id', scope.locationId)
    .not('work_type_level1_id', 'is', null)

  if (error) throw toThrownError(error)

  const ids = [
    ...new Set(
      (rows ?? [])
        .map(r => String((r as { work_type_level1_id?: string | null }).work_type_level1_id ?? ''))
        .filter(Boolean)
    ),
  ]
  if (ids.length === 0) return []

  const { data: wt, error: wtErr } = await supabase
    .from('work_type_level1')
    .select('id, code, name')
    .in('id', ids)
    .order('code')

  if (wtErr) throw toThrownError(wtErr)

  return (wt ?? []).map(w => ({
    id: String((w as { id: string }).id),
    code: String((w as { code?: string }).code ?? ''),
    name: String((w as { name?: string }).name ?? ''),
  }))
}

export async function fetchReportsSummary(supabase: SupabaseClient, filters: ReportsFilters): Promise<ReportsSummary> {
  let q = supabase
    .from('employee_timesheet_entries')
    .select('id, user_id, entry_date, total_hours, billable, client_id, location_id, work_type_level1_id')
    .gte('entry_date', filters.dateFrom)
    .lte('entry_date', filters.dateTo)

  if (filters.clientId) q = q.eq('client_id', filters.clientId)
  if (filters.technicianId) q = q.eq('user_id', filters.technicianId)
  if (filters.workTypeLevel1Id) q = q.eq('work_type_level1_id', filters.workTypeLevel1Id)
  if (filters.locationId) q = q.eq('location_id', filters.locationId)
  if (filters.billable === 'yes') q = q.eq('billable', true)
  if (filters.billable === 'no') q = q.eq('billable', false)

  const { data: entriesRaw, error: e1 } = await q

  if (e1) {
    console.warn('[fetchReportsSummary] employee_timesheet_entries:', getErrorMessage(e1))
  }
  let rows = (e1 ? [] : (entriesRaw ?? [])) as Array<{
    user_id: string
    entry_date: string
    total_hours: number
    billable: boolean
    client_id: string | null
    location_id: string | null
    work_type_level1_id: string | null
  }>

  rows = applyBillableFilter(
    rows.map(r => ({ ...r, billable: Boolean(r.billable) })),
    filters.billable
  )

  let totalHours = 0
  let billableHours = 0
  let nonBillableHours = 0
  const hoursByDayMap = new Map<string, number>()
  const techIds = new Set<string>()

  const hoursByUser = new Map<string, number>()
  rows.forEach(r => {
    const h = Number(r.total_hours) || 0
    totalHours += h
    if (r.billable) billableHours += h
    else nonBillableHours += h
    techIds.add(r.user_id)
    hoursByUser.set(r.user_id, (hoursByUser.get(r.user_id) ?? 0) + h)
    const d = String(r.entry_date).slice(0, 10)
    hoursByDayMap.set(d, (hoursByDayMap.get(d) ?? 0) + h)
  })

  const maintRes = await supabase
    .from('maintenance_reports')
    .select('id, status, inspection_date')
    .gte('inspection_date', filters.dateFrom)
    .lte('inspection_date', filters.dateTo)

  if (maintRes.error) {
    console.warn('[fetchReportsSummary] maintenance_reports:', getErrorMessage(maintRes.error))
  }
  const maintRows = maintRes.error ? [] : (maintRes.data ?? [])
  const jobsCompleted = maintRows.filter(r =>
    ['approved', 'completed'].includes(String(r.status ?? ''))
  ).length

  const quotesRes = await supabase
    .from('quotes')
    .select('total, created_at')
    .gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    .lte('created_at', `${filters.dateTo}T23:59:59.999Z`)

  if (quotesRes.error) {
    console.warn('[fetchReportsSummary] quotes:', getErrorMessage(quotesRes.error))
  }

  const pvcRes = await supabase
    .from('pvc_quotes')
    .select('final_price, created_at')
    .gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    .lte('created_at', `${filters.dateTo}T23:59:59.999Z`)

  if (pvcRes.error) {
    console.warn('[fetchReportsSummary] pvc_quotes:', getErrorMessage(pvcRes.error))
  }

  const quotesRows = quotesRes.error ? [] : (quotesRes.data ?? [])
  const pvcRows = pvcRes.error ? [] : (pvcRes.data ?? [])

  let revenueTotal = 0
  const revenueByDayMap = new Map<string, number>()
  ;(quotesRows ?? []).forEach(q => {
    const v = Number((q as { total?: number }).total) || 0
    revenueTotal += v
    const d = String((q as { created_at: string }).created_at).slice(0, 10)
    revenueByDayMap.set(d, (revenueByDayMap.get(d) ?? 0) + v)
  })
  ;(pvcRows ?? []).forEach(q => {
    const v = Number((q as { final_price?: number }).final_price) || 0
    revenueTotal += v
    const d = String((q as { created_at: string }).created_at).slice(0, 10)
    revenueByDayMap.set(d, (revenueByDayMap.get(d) ?? 0) + v)
  })

  const hoursByDay = [...hoursByDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => ({ date, hours: Math.round(hours * 100) / 100 }))

  const revenueByDay = [...revenueByDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))

  const billablePercent =
    totalHours > 0 ? Math.round((billableHours / totalHours) * 1000) / 10 : 0

  const techIdsForNames = [...hoursByUser.keys()]
  let techProfiles = new Map<string, string>()
  try {
    techProfiles = await loadProfilesMap(supabase, techIdsForNames)
  } catch (e) {
    console.warn('[fetchReportsSummary] profiles (technician names):', getErrorMessage(e))
  }
  const hoursByTechnician = [...hoursByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([uid, h]) => ({
      name: techProfiles.get(uid) ?? '—',
      hours: Math.round(h * 100) / 100,
    }))

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round(nonBillableHours * 100) / 100,
    billablePercent,
    jobsCompleted,
    revenueTotal: Math.round(revenueTotal * 100) / 100,
    activeTechnicians: techIds.size,
    hoursByDay,
    revenueByDay,
    hoursByTechnician,
  }
}

function groupRows(
  flat: TimecardReportRow[],
  groupBy: TimecardGroupBy
): TimecardGroupedResponse['groups'] {
  const orderKey = (r: TimecardReportRow) => {
    if (groupBy === 'day') return r.entry_date
    if (groupBy === 'technician') return r.technician_name + r.technician_id
    return r.client_name + (r.client_id ?? '')
  }

  const labelFor = (r: TimecardReportRow) => {
    if (groupBy === 'day') return r.entry_date
    if (groupBy === 'technician') return r.technician_name
    return r.client_name
  }

  const sorted = [...flat].sort((a, b) => {
    const k = orderKey(a).localeCompare(orderKey(b))
    if (k !== 0) return k
    return String(a.start_time ?? '').localeCompare(String(b.start_time ?? ''))
  })

  const groups: TimecardGroupedResponse['groups'] = []
  let currentKey = ''
  let bucket: TimecardReportRow[] = []
  let label = ''

  const flush = () => {
    if (bucket.length === 0) return
    const subtotalHours = Math.round(bucket.reduce((s, r) => s + r.total_hours, 0) * 100) / 100
    groups.push({ key: currentKey, label, rows: bucket, subtotalHours })
    bucket = []
  }

  sorted.forEach(r => {
    const k = groupBy === 'day' ? r.entry_date : groupBy === 'technician' ? r.technician_id : r.client_id ?? '—'
    const lab = labelFor(r)
    if (k !== currentKey) {
      flush()
      currentKey = k
      label = lab
    }
    bucket.push(r)
  })
  flush()

  return groups
}

const TIMECARD_SELECT_FLAT =
  'id, user_id, entry_date, client_id, location_id, work_type_level1_id, work_type_level2_id, task, start_time, end_time, break_minutes, total_hours, billable'

/** Explicit FKs so PostgREST embeds resolve reliably for export + analytics. */
const TIMECARD_SELECT_JOINED = `${TIMECARD_SELECT_FLAT},
      clients!employee_timesheet_entries_client_id_fkey ( id, name, company_name ),
      client_locations!employee_timesheet_entries_location_id_fkey ( id, client_id, location_name, suburb )`

function firstRelationEmbed<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return (raw[0] as T) ?? null
  return raw as T
}

function buildTimecardFilteredQuery(supabase: SupabaseClient, filters: ReportsFilters, select: string) {
  let q = supabase
    .from('employee_timesheet_entries')
    .select(select)
    .gte('entry_date', filters.dateFrom)
    .lte('entry_date', filters.dateTo)
  if (filters.clientId) q = q.eq('client_id', filters.clientId)
  if (filters.technicianId) q = q.eq('user_id', filters.technicianId)
  if (filters.workTypeLevel1Id) q = q.eq('work_type_level1_id', filters.workTypeLevel1Id)
  if (filters.locationId) q = q.eq('location_id', filters.locationId)
  if (filters.billable === 'yes') q = q.eq('billable', true)
  if (filters.billable === 'no') q = q.eq('billable', false)
  return q.order('entry_date', { ascending: true }).order('start_time', { ascending: true })
}

export async function fetchTimecardReport(
  supabase: SupabaseClient,
  filters: ReportsFilters,
  groupBy: TimecardGroupBy
): Promise<TimecardGroupedResponse> {
  /** Manager report exports only; service role restores joined client/location names when RLS hides lookup tables. */
  let queryClient: SupabaseClient = supabase
  try {
    const { createServiceRoleClient, getSupabaseUrlForServer } = await import('@/lib/supabase/serviceRole')
    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() || !getSupabaseUrlForServer()) {
      console.warn('[fetchTimecardReport] service role env incomplete; using caller Supabase client for entries + lookups')
    } else {
      queryClient = createServiceRoleClient()
    }
  } catch (e) {
    console.warn('[fetchTimecardReport] createServiceRoleClient failed, using caller client:', getErrorMessage(e))
  }

  let { data: entriesRaw, error } = await buildTimecardFilteredQuery(queryClient, filters, TIMECARD_SELECT_JOINED)

  if (error) {
    const r2 = await buildTimecardFilteredQuery(queryClient, filters, TIMECARD_SELECT_FLAT)
    if (r2.error) throw toThrownError(r2.error)
    entriesRaw = r2.data
  }

  let rows = (entriesRaw ?? []) as unknown as Array<Record<string, unknown>>
  rows = applyBillableFilter(
    rows.map(r => ({ ...r, billable: Boolean(r.billable) })),
    filters.billable
  )

  const userIds = rows.map(r => String(r.user_id))
  const locIds = rows.map(r => (r.location_id ? String(r.location_id) : null)).filter(Boolean) as string[]
  const l1 = rows.map(r => (r.work_type_level1_id ? String(r.work_type_level1_id) : null))
  const l2 = rows.map(r => (r.work_type_level2_id ? String(r.work_type_level2_id) : null))

  const [profiles, locs, wt] = await Promise.all([
    loadProfilesMap(queryClient, userIds).catch(e => {
      console.warn('[fetchTimecardReport] profiles:', getErrorMessage(e))
      return new Map<string, string>()
    }),
    mapWithServiceRoleFallback(loadLocationsMap, queryClient, locIds).catch(e => {
      console.warn('[fetchTimecardReport] client_locations:', getErrorMessage(e))
      return new Map<string, { label: string; client_id: string | null }>()
    }),
    loadWorkTypeLabels(queryClient, l1, l2).catch(e => {
      console.warn('[fetchTimecardReport] work types:', getErrorMessage(e))
      return { l1: new Map<string, string>(), l2: new Map<string, string>() }
    }),
  ])

  const clientIdSet = new Set<string>()
  for (const r of rows) {
    const raw = r as Record<string, unknown>
    if (r.client_id) clientIdSet.add(String(r.client_id))
    const jl = firstRelationEmbed<{ client_id?: unknown }>(raw.client_locations ?? raw.client_location)
    if (jl && typeof jl === 'object' && jl.client_id) {
      clientIdSet.add(String(jl.client_id))
    }
    const lid = r.location_id ? String(r.location_id) : null
    if (lid) {
      const fromLoc = locs.get(lid)?.client_id
      if (fromLoc) clientIdSet.add(fromLoc)
    }
  }

  const clients = await mapWithServiceRoleFallback(loadClientsMap, queryClient, [...clientIdSet]).catch(e => {
    console.warn('[fetchTimecardReport] clients:', getErrorMessage(e))
    return new Map<string, string>()
  })

  const flat: TimecardReportRow[] = rows.map(r => {
    const uid = String(r.user_id)
    const cid = r.client_id ? String(r.client_id) : null
    const lid = r.location_id ? String(r.location_id) : null
    const w1 = r.work_type_level1_id ? String(r.work_type_level1_id) : null
    const w2 = r.work_type_level2_id ? String(r.work_type_level2_id) : null
    const wtLine = [w1 ? wt.l1.get(w1) : '', w2 ? wt.l2.get(w2) : ''].filter(Boolean).join(' › ') || '—'

    const joinClient = firstRelationEmbed<
      Parameters<typeof clientDisplayName>[0] & Record<string, unknown>
    >((r as Record<string, unknown>).clients ?? (r as Record<string, unknown>).client)
    const joinLoc = firstRelationEmbed<Parameters<typeof locationDisplayName>[0] & Record<string, unknown>>(
      (r as Record<string, unknown>).client_locations ?? (r as Record<string, unknown>).client_location
    )

    const cidFromLocationMap = !cid && lid ? locs.get(lid)?.client_id ?? null : null
    const cidFromLocationEmbed =
      !cid &&
      joinLoc &&
      typeof joinLoc === 'object' &&
      (joinLoc as { client_id?: unknown }).client_id != null &&
      String((joinLoc as { client_id: unknown }).client_id).length > 0
        ? String((joinLoc as { client_id: unknown }).client_id)
        : null
    const resolvedClientId = cid ?? cidFromLocationMap ?? cidFromLocationEmbed

    const nameFromClientEmbed =
      joinClient && typeof joinClient === 'object' ? clientDisplayName(joinClient) : '—'
    const nameFromClientTable = resolvedClientId ? (clients.get(resolvedClientId) ?? '—') : '—'
    const clientName = nameFromClientEmbed !== '—' ? nameFromClientEmbed : nameFromClientTable

    const labelFromLocEmbed =
      joinLoc && typeof joinLoc === 'object' ? locationDisplayName(joinLoc) : '—'
    const labelFromLocMap = lid ? (locs.get(lid)?.label ?? '—') : '—'
    const locationLabel = labelFromLocEmbed !== '—' ? labelFromLocEmbed : labelFromLocMap

    const normTime = (t: unknown) => {
      const s = typeof t === 'string' ? t : t == null ? '' : String(t)
      return s.trim().slice(0, 5) || '—'
    }

    return {
      id: String(r.id ?? ''),
      entry_date: String(r.entry_date ?? '').slice(0, 10),
      technician_id: uid,
      technician_name: profiles.get(uid) ?? '—',
      client_id: resolvedClientId,
      client_name: clientName,
      location_id: lid,
      location_label: locationLabel,
      work_type: wtLine,
      task: String(r.task ?? ''),
      start_time: normTime(r.start_time),
      end_time: normTime(r.end_time),
      break_minutes: Number(r.break_minutes) || 0,
      total_hours: Math.round((Number(r.total_hours) || 0) * 100) / 100,
      billable: Boolean(r.billable),
    }
  })

  const groups = groupRows(flat, groupBy)
  const grandTotalHours = Math.round(flat.reduce((s, r) => s + r.total_hours, 0) * 100) / 100

  return { groupBy, groups, grandTotalHours }
}

export async function fetchMaintenanceReport(
  supabase: SupabaseClient,
  filters: ReportsFilters
): Promise<MaintenanceReportRow[]> {
  let techNameFilter: string | null = null
  if (filters.technicianId) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', filters.technicianId)
      .maybeSingle()
    if (prof) techNameFilter = profileName(prof as Parameters<typeof profileName>[0])
  }

  const { data: reports, error } = await supabase
    .from('maintenance_reports')
    .select(
      'id, technician_name, inspection_date, status, notes, total_doors, address, client_location_id, created_at'
    )
    .gte('inspection_date', filters.dateFrom)
    .lte('inspection_date', filters.dateTo)
    .order('inspection_date', { ascending: false })

  if (error) throw error
  let list = (reports ?? []) as Array<Record<string, unknown>>

  if (techNameFilter) {
    list = list.filter(r => String(r.technician_name ?? '').trim() === techNameFilter)
  }

  const locIds = list.map(r => (r.client_location_id ? String(r.client_location_id) : null)).filter(Boolean) as string[]
  const locMap = await loadLocationsMap(supabase, locIds)
  const clientIds = [...new Set(locIds.map(id => locMap.get(id)?.client_id).filter(Boolean) as string[])]
  const clientMap = await loadClientsMap(supabase, clientIds)

  if (filters.clientId) {
    list = list.filter(r => {
      const lid = r.client_location_id ? String(r.client_location_id) : null
      const cid = lid ? locMap.get(lid)?.client_id : null
      return cid === filters.clientId
    })
  }

  if (filters.locationId) {
    list = list.filter(r => String(r.client_location_id ?? '') === filters.locationId)
  }

  const reportIds = list.map(r => String(r.id))

  const checklistSummaryByReport = new Map<string, string>()
  const attachmentCountByReport = new Map<string, number>()

  if (reportIds.length > 0) {
    const { data: doors, error: de } = await supabase
      .from('maintenance_doors')
      .select('id, report_id')
      .in('report_id', reportIds)
    if (de) throw de

    const doorIds = (doors ?? []).map(d => String((d as { id: string }).id))
    const doorsByReport = new Map<string, string[]>()
    ;(doors ?? []).forEach(d => {
      const rid = String((d as { report_id: string }).report_id)
      const arr = doorsByReport.get(rid) ?? []
      arr.push(String((d as { id: string }).id))
      doorsByReport.set(rid, arr)
    })

    if (doorIds.length) {
      const { data: checks, error: ce } = await supabase
        .from('maintenance_checklist')
        .select('door_id, status')
        .in('door_id', doorIds)
      if (!ce && checks) {
        const doorToReport = new Map<string, string>()
        ;(doors ?? []).forEach(d => {
          doorToReport.set(String((d as { id: string }).id), String((d as { report_id: string }).report_id))
        })
        const agg = new Map<string, { good: number; caution: number; fault: number; na: number }>()
        ;(checks as { door_id: string; status: string }[]).forEach(c => {
          const rid = doorToReport.get(String(c.door_id))
          if (!rid) return
          const cur = agg.get(rid) ?? { good: 0, caution: 0, fault: 0, na: 0 }
          const st = String(c.status) as keyof typeof cur
          if (st in cur) cur[st] += 1
          agg.set(rid, cur)
        })
        agg.forEach((v, rid) => {
          const parts = [
            v.good ? `${v.good} good` : '',
            v.caution ? `${v.caution} caution` : '',
            v.fault ? `${v.fault} fault` : '',
            v.na ? `${v.na} n/a` : '',
          ].filter(Boolean)
          checklistSummaryByReport.set(rid, parts.join(' · ') || '—')
        })
      }

      const { data: photos, error: pe } = await supabase.from('maintenance_photos').select('door_id').in('door_id', doorIds)
      if (!pe && photos) {
        const photoCountByDoor = new Map<string, number>()
        ;(photos as { door_id: string }[]).forEach(p => {
          const id = String(p.door_id)
          photoCountByDoor.set(id, (photoCountByDoor.get(id) ?? 0) + 1)
        })
        doorsByReport.forEach((dids, rid) => {
          let n = 0
          dids.forEach(did => {
            n += photoCountByDoor.get(did) ?? 0
          })
          attachmentCountByReport.set(rid, n)
        })
      }
    }
  }

  return list.map(r => {
    const id = String(r.id)
    const lid = r.client_location_id ? String(r.client_location_id) : null
    const cid = lid ? locMap.get(lid)?.client_id ?? null : null
    const clientName = cid ? clientMap.get(cid) ?? '—' : '—'
    const site = lid ? locMap.get(lid)?.label ?? String(r.address ?? '—') : String(r.address ?? '—')

    return {
      id,
      client_name: clientName,
      site_location: site,
      technician_name: String(r.technician_name ?? '—'),
      inspection_date: String(r.inspection_date ?? '').slice(0, 10),
      status: String(r.status ?? '—'),
      total_doors: Number(r.total_doors) || 0,
      checklist_summary: checklistSummaryByReport.get(id) ?? '—',
      issues_preview: String(r.notes ?? '').trim().slice(0, 120) || '—',
      attachment_count: attachmentCountByReport.get(id) ?? 0,
    }
  })
}

export async function fetchGpsReport(
  supabase: SupabaseClient,
  filters: ReportsFilters,
  includeCoords: boolean
): Promise<GpsReportRow[]> {
  const { data: entriesRaw, error } = await supabase
    .from('employee_timesheet_entries')
    .select(
      'id, user_id, client_id, location_id, work_type_level1_id, entry_date, gps_start_address, gps_end_address, gps_start, gps_end, gps_start_lat, gps_start_lng, gps_end_lat, gps_end_lng'
    )
    .gte('entry_date', filters.dateFrom)
    .lte('entry_date', filters.dateTo)
    .order('entry_date', { ascending: false })

  if (error) throw toThrownError(error)

  function coordsFromRow(r: Record<string, unknown>, leg: 'start' | 'end'): string | null {
    const gs = mergeGpsPointFromRow(
      leg === 'start' ? r.gps_start : r.gps_end,
      leg === 'start' ? r.gps_start_lat : r.gps_end_lat,
      leg === 'start' ? r.gps_start_lng : r.gps_end_lng
    )
    if (!gs) return null
    return `${gs.lat.toFixed(5)}, ${gs.lng.toFixed(5)}`
  }

  let rows = (entriesRaw ?? []) as Array<Record<string, unknown>>

  if (filters.technicianId) rows = rows.filter(r => String(r.user_id) === filters.technicianId)
  if (filters.clientId) rows = rows.filter(r => String(r.client_id ?? '') === filters.clientId)
  if (filters.locationId) rows = rows.filter(r => String(r.location_id ?? '') === filters.locationId)
  if (filters.workTypeLevel1Id) {
    rows = rows.filter(r => String(r.work_type_level1_id ?? '') === filters.workTypeLevel1Id)
  }

  rows = rows.filter(r => {
    const a = String(r.gps_start_address ?? '').trim()
    const b = String(r.gps_end_address ?? '').trim()
    const gs = mergeGpsPointFromRow(r.gps_start, r.gps_start_lat, r.gps_start_lng)
    const ge = mergeGpsPointFromRow(r.gps_end, r.gps_end_lat, r.gps_end_lng)
    return a.length > 0 || b.length > 0 || (gs != null && ge != null)
  })

  const userIds = rows.map(r => String(r.user_id))
  const profiles = await loadProfilesMap(supabase, userIds).catch(e => {
    console.warn('[fetchGpsReport] profiles:', getErrorMessage(e))
    return new Map<string, string>()
  })

  return rows.map(r => {
    const gs = mergeGpsPointFromRow(r.gps_start, r.gps_start_lat, r.gps_start_lng)
    const ge = mergeGpsPointFromRow(r.gps_end, r.gps_end_lat, r.gps_end_lng)
    return {
      id: String(r.id),
      entry_date: String(r.entry_date).slice(0, 10),
      technician_name: profiles.get(String(r.user_id)) ?? '—',
      start_address: String(r.gps_start_address ?? '').trim() || '—',
      end_address: String(r.gps_end_address ?? '').trim() || '—',
      start_lat: gs?.lat ?? null,
      start_lng: gs?.lng ?? null,
      end_lat: ge?.lat ?? null,
      end_lng: ge?.lng ?? null,
      start_coords: includeCoords ? coordsFromRow(r, 'start') : null,
      end_coords: includeCoords ? coordsFromRow(r, 'end') : null,
    }
  })
}

export async function fetchQuotesReport(
  supabase: SupabaseClient,
  filters: ReportsFilters
): Promise<{
  summary: QuotesReportSummary
  trends: QuoteTrendRow[]
  serviceLines: QuoteServiceLine[]
  pvcLines: QuotePvcLine[]
}> {
  const quotesRes = await supabase
    .from('quotes')
    .select('id, quote_number, customer_name, total, created_at')
    .gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    .lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
    .order('created_at', { ascending: true })

  if (quotesRes.error) {
    console.warn('[fetchQuotesReport] quotes:', getErrorMessage(quotesRes.error))
  }

  const pvcRes = await supabase
    .from('pvc_quotes')
    .select('id, final_price, created_at')
    .gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
    .lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
    .order('created_at', { ascending: true })

  if (pvcRes.error) {
    console.warn('[fetchQuotesReport] pvc_quotes:', getErrorMessage(pvcRes.error))
  }

  const quotesRows = quotesRes.error ? [] : (quotesRes.data ?? [])
  const pvcRows = pvcRes.error ? [] : (pvcRes.data ?? [])

  const serviceQuotesCount = quotesRows.length
  const serviceQuotesTotal = (quotesRows ?? []).reduce((s, q) => s + (Number((q as { total?: number }).total) || 0), 0)
  const pvcQuotesCount = (pvcRows ?? []).length
  const pvcQuotesTotal = (pvcRows ?? []).reduce((s, q) => s + (Number((q as { final_price?: number }).final_price) || 0), 0)

  const byWeek = new Map<string, { service: number; pvc: number }>()
  const addWeek = (iso: string, field: 'service' | 'pvc', v: number) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return
    const day = d.getUTCDay()
    const diff = (day + 6) % 7
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() - diff)
    const key = monday.toISOString().slice(0, 10)
    const cur = byWeek.get(key) ?? { service: 0, pvc: 0 }
    cur[field] += v
    byWeek.set(key, cur)
  }

  ;(quotesRows ?? []).forEach(q =>
    addWeek(String((q as { created_at: string }).created_at), 'service', Number((q as { total?: number }).total) || 0)
  )
  ;(pvcRows ?? []).forEach(q =>
    addWeek(String((q as { created_at: string }).created_at), 'pvc', Number((q as { final_price?: number }).final_price) || 0)
  )

  const trends: QuoteTrendRow[] = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      service_total: Math.round(v.service * 100) / 100,
      pvc_total: Math.round(v.pvc * 100) / 100,
    }))

  const serviceLines: QuoteServiceLine[] = (quotesRows ?? []).map(q => {
    const row = q as {
      id: string
      quote_number?: string | null
      customer_name?: string | null
      total?: number | null
      created_at: string
    }
    return {
      id: String(row.id),
      quoteNumber: String(row.quote_number ?? ''),
      customerName: String(row.customer_name ?? ''),
      total: Math.round((Number(row.total) || 0) * 100) / 100,
      createdAtLabel: String(row.created_at ?? '').slice(0, 10),
    }
  })

  const pvcLines: QuotePvcLine[] = (pvcRows ?? []).map(q => {
    const row = q as { id: string; final_price?: number | null; created_at: string }
    return {
      id: String(row.id),
      finalPrice: Math.round((Number(row.final_price) || 0) * 100) / 100,
      createdAtLabel: String(row.created_at ?? '').slice(0, 10),
    }
  })

  return {
    summary: {
      serviceQuotesCount,
      serviceQuotesTotal: Math.round(serviceQuotesTotal * 100) / 100,
      pvcQuotesCount,
      pvcQuotesTotal: Math.round(pvcQuotesTotal * 100) / 100,
      pipelineNote:
        'Quote approval status is not stored in the database yet; totals reflect all service quotes and PVC estimates in the date range.',
    },
    trends,
    serviceLines,
    pvcLines,
  }
}
