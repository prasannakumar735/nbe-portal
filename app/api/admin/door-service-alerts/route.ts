import { requireManagerOrAdminApi, ok, fail } from '@/app/api/admin/_utils'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'

export const runtime = 'nodejs'

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1 + months, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function subtractDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d - days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const today = melbourneCalendarDate(new Date())

  // ── Read settings ────────────────────────────────────────────────────────
  const { data: settingsRaw } = await auth.supabase
    .from('portal_notification_settings')
    .select('key, value')

  const settingsMap = Object.fromEntries(
    (settingsRaw ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  )
  const leadTimeDays = parseInt(settingsMap['door_service_lead_time_days'] ?? '15', 10) || 15
  const serviceIntervalMonths = parseInt(settingsMap['door_service_interval_months'] ?? '6', 10) || 6

  // ── Load all doors with their latest inspection ──────────────────────────
  const { data: doorsRaw, error: doorsErr } = await auth.supabase
    .from('doors')
    .select('id, door_label, door_type, install_date, client_location_id')
    .not('client_location_id', 'is', null)

  if (doorsErr) return fail(doorsErr.message, 400)

  const doors = (doorsRaw ?? []) as Array<{
    id: string
    door_label: string
    door_type: string | null
    install_date: string | null
    client_location_id: string
  }>

  if (!doors.length) {
    return ok({ stats: { overdue: 0, next7: 0, next14: 0, next30: 0, total: 0 }, groups: [], leadTimeDays, serviceIntervalMonths })
  }

  // Latest inspection per door
  const { data: inspectionsRaw } = await auth.supabase
    .from('door_inspections')
    .select('door_id, created_at')
    .in('door_id', doors.map(d => d.id))
    .order('created_at', { ascending: false })

  const latestInspectionByDoor = new Map<string, string>()
  for (const ins of inspectionsRaw ?? []) {
    const row = ins as { door_id: string; created_at: string }
    if (!latestInspectionByDoor.has(row.door_id)) {
      latestInspectionByDoor.set(row.door_id, row.created_at.slice(0, 10))
    }
  }

  // Already alerted door IDs
  const { data: alertLogsRaw } = await auth.supabase
    .from('door_service_alert_log')
    .select('client_location_id, door_ids, sent_at')
    .order('sent_at', { ascending: false })

  const alertedByLocation = new Map<string, Set<string>>()
  for (const log of alertLogsRaw ?? []) {
    const row = log as { client_location_id: string; door_ids: string[]; sent_at: string }
    const set = alertedByLocation.get(row.client_location_id) ?? new Set<string>()
    for (const id of row.door_ids ?? []) set.add(id)
    alertedByLocation.set(row.client_location_id, set)
  }

  // ── Compute due date per door ─────────────────────────────────────────────
  type DoorWithDue = {
    id: string
    door_label: string
    door_type: string | null
    client_location_id: string
    install_date: string | null
    last_inspection_date: string | null
    due_date: string
    notify_date: string
    already_alerted: boolean
    status: 'overdue' | 'next7' | 'next14' | 'next30' | 'future'
  }

  const next7 = addDays(today, 7)
  const next14 = addDays(today, 14)
  const next30 = addDays(today, 30)

  const enrichedDoors: DoorWithDue[] = []
  for (const door of doors) {
    const lastInspection = latestInspectionByDoor.get(door.id) ?? null
    const baseline = lastInspection ?? door.install_date
    if (!baseline) continue

    const due_date = addMonths(baseline, serviceIntervalMonths)
    const notify_date = subtractDays(due_date, leadTimeDays)
    const alerted = alertedByLocation.get(door.client_location_id)?.has(door.id) ?? false

    let status: DoorWithDue['status'] = 'future'
    if (due_date < today) status = 'overdue'
    else if (due_date <= next7) status = 'next7'
    else if (due_date <= next14) status = 'next14'
    else if (due_date <= next30) status = 'next30'

    // Only include doors that are in or approaching alert window
    if (notify_date > next30 && status === 'future') continue

    enrichedDoors.push({
      ...door,
      last_inspection_date: lastInspection,
      due_date,
      notify_date,
      already_alerted: alerted,
      status,
    })
  }

  // ── Load location + client metadata ──────────────────────────────────────
  const locationIds = [...new Set(enrichedDoors.map(d => d.client_location_id))]

  const { data: locationsRaw } = await auth.supabase
    .from('client_locations')
    .select('id, client_id, location_name, suburb')
    .in('id', locationIds)

  const locationById = new Map<string, { client_id: string; location_name: string }>()
  const clientIds: string[] = []
  for (const loc of locationsRaw ?? []) {
    const row = loc as { id: string; client_id: string; location_name: string | null; suburb: string | null }
    locationById.set(row.id, {
      client_id: row.client_id,
      location_name: String(row.location_name ?? row.suburb ?? '').trim() || 'Unknown location',
    })
    clientIds.push(row.client_id)
  }

  const { data: clientsRaw } = await auth.supabase
    .from('clients')
    .select('id, name')
    .in('id', [...new Set(clientIds)])

  const clientNameById = new Map<string, string>()
  for (const c of clientsRaw ?? []) {
    const row = c as { id: string; name: string | null }
    clientNameById.set(row.id, String(row.name ?? '').trim() || 'Unknown client')
  }

  // ── Group by client then location ─────────────────────────────────────────
  type LocationSummary = {
    locationId: string
    locationName: string
    doors: DoorWithDue[]
    earliestDue: string
    alertEmailSentAt: string | null
  }
  type ClientGroup = {
    clientId: string
    clientName: string
    locations: LocationSummary[]
    doorCount: number
    overdueCount: number
    nextAlertCount: number
  }

  const clientMap = new Map<string, ClientGroup>()
  const locationAlertSentAt = new Map<string, string | null>()
  for (const log of alertLogsRaw ?? []) {
    const row = log as { client_location_id: string; sent_at: string }
    if (!locationAlertSentAt.has(row.client_location_id)) {
      locationAlertSentAt.set(row.client_location_id, row.sent_at)
    }
  }

  for (const door of enrichedDoors) {
    const loc = locationById.get(door.client_location_id)
    if (!loc) continue
    const clientName = clientNameById.get(loc.client_id) ?? 'Unknown'

    let cg = clientMap.get(loc.client_id)
    if (!cg) {
      cg = { clientId: loc.client_id, clientName, locations: [], doorCount: 0, overdueCount: 0, nextAlertCount: 0 }
      clientMap.set(loc.client_id, cg)
    }

    let lg = cg.locations.find(l => l.locationId === door.client_location_id)
    if (!lg) {
      lg = {
        locationId: door.client_location_id,
        locationName: loc.location_name,
        doors: [],
        earliestDue: door.due_date,
        alertEmailSentAt: locationAlertSentAt.get(door.client_location_id) ?? null,
      }
      cg.locations.push(lg)
    }

    lg.doors.push(door)
    if (door.due_date < lg.earliestDue) lg.earliestDue = door.due_date

    cg.doorCount++
    if (door.status === 'overdue') cg.overdueCount++
    if (!door.already_alerted && door.notify_date <= today) cg.nextAlertCount++
  }

  // Sort: clients with most urgent doors first
  const groups = [...clientMap.values()].sort((a, b) => b.overdueCount - a.overdueCount || b.nextAlertCount - a.nextAlertCount)
  for (const g of groups) {
    g.locations.sort((a, b) => a.earliestDue.localeCompare(b.earliestDue))
    for (const l of g.locations) {
      l.doors.sort((a, b) => a.due_date.localeCompare(b.due_date))
    }
  }

  const stats = {
    overdue: enrichedDoors.filter(d => d.status === 'overdue').length,
    next7: enrichedDoors.filter(d => d.status === 'next7').length,
    next14: enrichedDoors.filter(d => d.status === 'next14').length,
    next30: enrichedDoors.filter(d => d.status === 'next30').length,
    total: enrichedDoors.length,
    pendingAlerts: enrichedDoors.filter(d => !d.already_alerted && d.notify_date <= today).length,
    clientsAffected: clientMap.size,
  }

  return ok({ stats, groups, leadTimeDays, serviceIntervalMonths })
}
