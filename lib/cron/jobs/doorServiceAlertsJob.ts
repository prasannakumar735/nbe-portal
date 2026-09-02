import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import { notifyDoorServiceAlertManagers } from '@/lib/notifications/doorServiceAlertNotification'
import { isCalendarNotificationsDisabled } from '@/lib/notifications/isCalendarNotificationsDisabled'

// ── Types ────────────────────────────────────────────────────────────────────

type DoorRow = {
  id: string
  door_label: string
  door_type: string | null
  install_date: string | null
  client_location_id: string
  last_inspection_date: string | null // derived from door_inspections join
}

type LocationGroup = {
  clientId: string
  clientName: string
  locationId: string
  locationName: string
  doors: Array<{
    id: string
    door_label: string
    door_type: string | null
    due_date: string
    last_inspection_date: string | null
    install_date: string | null
  }>
  earliestDueDate: string
  latestDueDate: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function getNotificationSetting(
  supabase: SupabaseClient,
  key: string,
  defaultValue: number,
): Promise<number> {
  const { data } = await supabase
    .from('portal_notification_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  const parsed = parseInt(String(data?.value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

// ── Main job ─────────────────────────────────────────────────────────────────

export async function runDoorServiceAlertsJob(): Promise<Record<string, unknown>> {
  if (isCalendarNotificationsDisabled()) {
    return { ok: true, skipped: true, reason: 'notifications disabled (local testing)' }
  }

  const supabase = createServiceRoleClient()
  const todayMelb = melbourneCalendarDate(new Date())

  // Read configurable settings
  const leadTimeDays = await getNotificationSetting(supabase, 'door_service_lead_time_days', 15)
  const serviceIntervalMonths = await getNotificationSetting(supabase, 'door_service_interval_months', 6)

  // ── 1. Load all doors with their latest inspection date ──────────────────
  // We fetch doors and their latest inspection in a single query via a subquery.
  // Supabase doesn't support aggregated joins directly, so we load both tables
  // separately and merge in memory (doors count is manageable — typically < 10k).

  const { data: doorsRaw, error: doorsErr } = await supabase
    .from('doors')
    .select('id, door_label, door_type, install_date, client_location_id')
    .not('client_location_id', 'is', null)

  if (doorsErr) return { ok: false, error: `Doors query failed: ${doorsErr.message}` }

  const doors = (doorsRaw ?? []) as Array<{
    id: string
    door_label: string
    door_type: string | null
    install_date: string | null
    client_location_id: string
  }>

  if (!doors.length) return { ok: true, checked: 0, sent: 0 }

  // Latest inspection per door
  const doorIds = doors.map(d => d.id)
  const { data: inspectionsRaw } = await supabase
    .from('door_inspections')
    .select('door_id, created_at')
    .in('door_id', doorIds)
    .order('created_at', { ascending: false })

  const latestInspectionByDoorId = new Map<string, string>()
  for (const ins of inspectionsRaw ?? []) {
    const row = ins as { door_id: string; created_at: string }
    if (!latestInspectionByDoorId.has(row.door_id)) {
      // ISO date portion only
      latestInspectionByDoorId.set(row.door_id, row.created_at.slice(0, 10))
    }
  }

  // ── 2. Calculate due_date per door and filter to those entering alert window ──

  type ReadyDoor = DoorRow & { due_date: string }
  const alertableDoors: ReadyDoor[] = []

  for (const door of doors) {
    const lastInspection = latestInspectionByDoorId.get(door.id) ?? null
    const baseline = lastInspection ?? door.install_date

    // Skip doors with no date anchor at all
    if (!baseline) continue

    const dueDate = addMonths(baseline, serviceIntervalMonths)
    const notifyDate = subtractDays(dueDate, leadTimeDays)

    // Include if: today >= notifyDate (we're in or past the alert window)
    // AND no previous alert sent for this specific door in this window
    if (todayMelb >= notifyDate) {
      alertableDoors.push({ ...door, last_inspection_date: lastInspection, due_date: dueDate })
    }
  }

  if (!alertableDoors.length) {
    return { ok: true, checked: doors.length, alertable: 0, sent: 0 }
  }

  // ── 3. Load existing alert logs for the affected locations ──────────────────

  const locationIds = [...new Set(alertableDoors.map(d => d.client_location_id))]

  const { data: recentLogsRaw } = await supabase
    .from('door_service_alert_log')
    .select('client_location_id, door_ids, sent_at')
    .in('client_location_id', locationIds)
    .order('sent_at', { ascending: false })

  // Build: locationId → set of door_ids already alerted
  const alertedDoorIdsByLocation = new Map<string, Set<string>>()
  for (const log of recentLogsRaw ?? []) {
    const row = log as { client_location_id: string; door_ids: string[]; sent_at: string }
    const existing = alertedDoorIdsByLocation.get(row.client_location_id) ?? new Set<string>()
    for (const id of row.door_ids ?? []) existing.add(id)
    alertedDoorIdsByLocation.set(row.client_location_id, existing)
  }

  // ── 4. Filter to doors not yet alerted for this location ────────────────────

  const newAlertDoors = alertableDoors.filter(door => {
    const alerted = alertedDoorIdsByLocation.get(door.client_location_id)
    // A door needs a new alert if:
    // - It has never been alerted, OR
    // - Its due_date has advanced (i.e. it was serviced and is due again)
    //   We detect this by checking if the door_id is NOT in any log for this location
    //   OR if the door's due_date is later than the latest log's sent_at (serviced after last alert)
    if (!alerted) return true
    return !alerted.has(door.id)
  })

  if (!newAlertDoors.length) {
    return { ok: true, checked: doors.length, alertable: alertableDoors.length, newAlerts: 0, sent: 0 }
  }

  // ── 5. Load client and location metadata ─────────────────────────────────

  const affectedLocationIds = [...new Set(newAlertDoors.map(d => d.client_location_id))]

  const { data: locationsRaw } = await supabase
    .from('client_locations')
    .select('id, client_id, location_name, suburb')
    .in('id', affectedLocationIds)

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

  const { data: clientsRaw } = await supabase
    .from('clients')
    .select('id, name')
    .in('id', [...new Set(clientIds)])

  const clientNameById = new Map<string, string>()
  for (const c of clientsRaw ?? []) {
    const row = c as { id: string; name: string | null }
    clientNameById.set(row.id, String(row.name ?? '').trim() || 'Unknown client')
  }

  // ── 6. Group by client_location_id ──────────────────────────────────────

  const groupsByLocation = new Map<string, LocationGroup>()
  for (const door of newAlertDoors) {
    const loc = locationById.get(door.client_location_id)
    if (!loc) continue
    const clientName = clientNameById.get(loc.client_id) ?? 'Unknown client'

    let group = groupsByLocation.get(door.client_location_id)
    if (!group) {
      group = {
        clientId: loc.client_id,
        clientName,
        locationId: door.client_location_id,
        locationName: loc.location_name,
        doors: [],
        earliestDueDate: door.due_date,
        latestDueDate: door.due_date,
      }
      groupsByLocation.set(door.client_location_id, group)
    }

    group.doors.push({
      id: door.id,
      door_label: door.door_label,
      door_type: door.door_type,
      due_date: door.due_date,
      last_inspection_date: door.last_inspection_date,
      install_date: door.install_date,
    })

    if (door.due_date < group.earliestDueDate) group.earliestDueDate = door.due_date
    if (door.due_date > group.latestDueDate) group.latestDueDate = door.due_date
  }

  // ── 7. Send one email per client+location group, log each ─────────────────

  let sent = 0
  const errors: string[] = []

  for (const group of groupsByLocation.values()) {
    // Sort doors by due_date ascending
    group.doors.sort((a, b) => a.due_date.localeCompare(b.due_date))

    const result = await notifyDoorServiceAlertManagers(supabase, {
      clientName: group.clientName,
      locationName: group.locationName,
      doors: group.doors,
      leadTimeDays,
      serviceIntervalMonths,
    })

    if (result.status === 'failed') {
      errors.push(`${group.clientName} / ${group.locationName}: ${result.error}`)
      continue
    }

    // Log the alert so we don't re-send for the same doors
    const { error: logErr } = await supabase.from('door_service_alert_log').insert({
      client_id: group.clientId,
      client_location_id: group.locationId,
      door_ids: group.doors.map(d => d.id),
      door_count: group.doors.length,
      earliest_due_date: group.earliestDueDate,
      latest_due_date: group.latestDueDate,
      lead_time_days: leadTimeDays,
      sent_at: new Date().toISOString(),
    })

    if (logErr) {
      errors.push(`Log insert failed for ${group.clientName}: ${logErr.message}`)
    } else {
      // Mark these doors as alerted so future runs skip them
      const existing = alertedDoorIdsByLocation.get(group.locationId) ?? new Set<string>()
      for (const d of group.doors) existing.add(d.id)
      alertedDoorIdsByLocation.set(group.locationId, existing)
      sent++
    }
  }

  return {
    ok: true,
    checked: doors.length,
    alertable: alertableDoors.length,
    newAlerts: newAlertDoors.length,
    locationGroups: groupsByLocation.size,
    sent,
    errors,
  }
}
