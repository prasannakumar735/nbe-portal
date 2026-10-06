import type { SupabaseClient } from '@supabase/supabase-js'
import { profileDisplayName, type ProfileFromTable } from '@/lib/auth/roles'
import { attendanceClockInUtcBounds } from '@/lib/officeClock/attendanceRange'
import {
  computeRangeAttendanceSummary,
  type AttendanceDashboard,
  type AttendanceSignedInNowRow,
} from '@/lib/officeClock/attendanceDashboard'
import { melbourneCalendarDate, melbourneHHMM } from '@/lib/officeClock/melbourneWallClock'
import { formatDurationHm, grossMinutesBetween } from '@/lib/timecard/formatDuration'

export type AttendanceEmployeeOption = { id: string; name: string }

export type ManagerAttendanceRow = {
  sessionId: string
  userId: string
  employeeName: string
  dateMelbourne: string
  signInMelbourne: string
  signOutMelbourne: string | null
  status: 'open' | 'closed' | 'system_logged_out'
  siteName: string
  durationHours: number | null
  durationGrossMinutes: number | null
  durationDisplay: string | null
  clockInDistanceMetres: number | null
  clockOutDistanceMetres: number | null
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export type ManagerAttendanceResult = {
  dateFrom: string
  dateTo: string
  employees: AttendanceEmployeeOption[]
  rows: ManagerAttendanceRow[]
  dashboard: AttendanceDashboard
}

function mapAttendanceStatus(
  closed: boolean,
  closeKind: unknown,
): ManagerAttendanceRow['status'] {
  if (!closed) return 'open'
  if (closeKind === 'system') return 'system_logged_out'
  return 'closed'
}

function durationHoursFromMinutes(grossMin: number): number {
  return Math.round((grossMin / 60) * 100) / 100
}

function siteDisplayName(row: Record<string, unknown>): string {
  const embed = row.office_clock_sites
  if (embed && typeof embed === 'object' && !Array.isArray(embed)) {
    const name = String((embed as { display_name?: unknown }).display_name ?? '').trim()
    if (name) return name
  }
  if (Array.isArray(embed) && embed[0] && typeof embed[0] === 'object') {
    const name = String((embed[0] as { display_name?: unknown }).display_name ?? '').trim()
    if (name) return name
  }
  return 'Unknown site'
}

export async function loadPortalStaffForAttendance(
  admin: SupabaseClient,
): Promise<AttendanceEmployeeOption[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, first_name, last_name, role')
    .neq('role', 'client')
    .order('full_name', { ascending: true })

  if (error) throw error

  const list: AttendanceEmployeeOption[] = []
  for (const p of data ?? []) {
    const row = p as ProfileFromTable & { id: string }
    const name = profileDisplayName(row)
    list.push({ id: String(row.id), name: name || 'Unknown' })
  }
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return list
}

async function fetchSignedInNowAndTodayCount(
  admin: SupabaseClient,
  profileById: Map<string, string>,
): Promise<{ loggedInTodayCount: number; signedInNow: AttendanceSignedInNowRow[] }> {
  const todayMelbourne = melbourneCalendarDate(new Date())
  const { startIso, endExclusiveIso } = attendanceClockInUtcBounds(todayMelbourne, todayMelbourne)

  const [todayRes, openRes] = await Promise.all([
    admin.from('office_attendance_sessions').select('user_id').gte('clock_in_at', startIso).lt('clock_in_at', endExclusiveIso),
    admin
      .from('office_attendance_sessions')
      .select('id, user_id, clock_in_at, site_id, office_clock_sites(display_name)')
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(50),
  ])

  const todayIds = new Set<string>()
  for (const r of todayRes.data ?? []) {
    todayIds.add(String((r as { user_id: string }).user_id))
  }

  const signedInNow: AttendanceSignedInNowRow[] = []
  const openRows = openRes.error
    ? (
        await admin
          .from('office_attendance_sessions')
          .select('id, user_id, clock_in_at, site_id')
          .is('clock_out_at', null)
          .order('clock_in_at', { ascending: false })
          .limit(50)
      ).data ?? []
    : openRes.data ?? []

  const openSiteIds = [
    ...new Set(openRows.map(r => (r as Record<string, unknown>).site_id).filter(Boolean).map(id => String(id))),
  ]
  const openSiteNames = new Map<string, string>()
  if (openSiteIds.length > 0) {
    const { data: sites } = await admin.from('office_clock_sites').select('id, display_name').in('id', openSiteIds)
    for (const s of sites ?? []) {
      const row = s as { id: string; display_name?: string }
      openSiteNames.set(String(row.id), String(row.display_name ?? '').trim() || 'Unknown site')
    }
  }

  for (const raw of openRows) {
    const row = raw as Record<string, unknown>
    const clockIn = new Date(String(row.clock_in_at ?? ''))
    if (Number.isNaN(clockIn.getTime())) continue
    const uid = String(row.user_id)
    let siteName = siteDisplayName(row)
    if (siteName === 'Unknown site' && row.site_id) {
      siteName = openSiteNames.get(String(row.site_id)) ?? siteName
    }
    signedInNow.push({
      sessionId: String(row.id),
      userId: uid,
      employeeName: profileById.get(uid) ?? 'Unknown',
      dateMelbourne: melbourneCalendarDate(clockIn),
      signInMelbourne: melbourneHHMM(clockIn),
      siteName,
    })
  }

  signedInNow.sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
  )

  return { loggedInTodayCount: todayIds.size, signedInNow }
}

export async function fetchManagerAttendance(
  admin: SupabaseClient,
  params: { dateFrom: string; dateTo: string; userId?: string | null },
): Promise<ManagerAttendanceResult> {
  const { startIso, endExclusiveIso } = attendanceClockInUtcBounds(params.dateFrom, params.dateTo)

  let q = admin
    .from('office_attendance_sessions')
    .select(
      'id, user_id, clock_in_at, clock_out_at, close_kind, site_id, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng, office_clock_sites(display_name, slug, site_lat, site_lng)',
    )
    .gte('clock_in_at', startIso)
    .lt('clock_in_at', endExclusiveIso)
    .order('clock_in_at', { ascending: false })

  const userId = params.userId?.trim()
  if (userId) {
    q = q.eq('user_id', userId)
  }

  let sessions: Record<string, unknown>[] | null = null
  const joined = await q
  if (joined.error) {
    let flatQ = admin
      .from('office_attendance_sessions')
      .select('id, user_id, clock_in_at, clock_out_at, close_kind, site_id, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng')
      .gte('clock_in_at', startIso)
      .lt('clock_in_at', endExclusiveIso)
      .order('clock_in_at', { ascending: false })
    if (userId) flatQ = flatQ.eq('user_id', userId)
    const flat = await flatQ
    if (flat.error) throw flat.error
    sessions = (flat.data ?? []) as Record<string, unknown>[]
  } else {
    sessions = (joined.data ?? []) as Record<string, unknown>[]
  }

  const [employees, profilesRes] = await Promise.all([
    loadPortalStaffForAttendance(admin),
    admin.from('profiles').select('id, full_name, first_name, last_name'),
  ])

  const profileById = new Map<string, string>()
  for (const p of profilesRes.data ?? []) {
    const row = p as ProfileFromTable & { id: string }
    profileById.set(String(row.id), profileDisplayName(row) || 'Unknown')
  }

  const siteNameById = new Map<string, string>()
  const siteIds = [
    ...new Set(sessions.map(s => s.site_id).filter(Boolean).map(id => String(id))),
  ]
  const siteLatLngById = new Map<string, { lat: number; lng: number }>()
  if (siteIds.length > 0) {
    const { data: sites } = await admin
      .from('office_clock_sites')
      .select('id, display_name, site_lat, site_lng')
      .in('id', siteIds)
    for (const s of sites ?? []) {
      const row = s as { id: string; display_name?: string; site_lat?: number | null; site_lng?: number | null }
      siteNameById.set(String(row.id), String(row.display_name ?? '').trim() || 'Unknown site')
      if (row.site_lat != null && row.site_lng != null) {
        siteLatLngById.set(String(row.id), { lat: Number(row.site_lat), lng: Number(row.site_lng) })
      }
    }
  }

  const rows: ManagerAttendanceRow[] = []
  for (const row of sessions) {
    const sessionId = String(row.id)
    const uid = String(row.user_id)
    const clockInAt = String(row.clock_in_at ?? '')
    const clockIn = new Date(clockInAt)
    if (Number.isNaN(clockIn.getTime())) continue

    const clockOutRaw = row.clock_out_at
    const clockOut =
      clockOutRaw != null && String(clockOutRaw).trim() ? new Date(String(clockOutRaw)) : null
    const closed = clockOut != null && !Number.isNaN(clockOut.getTime())

    let siteName = siteDisplayName(row)
    if (siteName === 'Unknown site' && row.site_id) {
      siteName = siteNameById.get(String(row.site_id)) ?? siteName
    }

    const grossMin =
      closed && clockOut ? grossMinutesBetween(clockIn, clockOut) : null

    // Resolve site coords — prefer joined, fall back to separately loaded
    let siteLat: number | null = null
    let siteLng: number | null = null
    const joinedSite = row.office_clock_sites as Record<string, unknown> | null | undefined
    if (joinedSite?.site_lat != null && joinedSite?.site_lng != null) {
      siteLat = Number(joinedSite.site_lat)
      siteLng = Number(joinedSite.site_lng)
    } else if (row.site_id) {
      const s = siteLatLngById.get(String(row.site_id))
      if (s) { siteLat = s.lat; siteLng = s.lng }
    }

    const calcDist = (lat: unknown, lng: unknown): number | null => {
      if (siteLat == null || siteLng == null) return null
      if (lat == null || lng == null) return null
      const la = Number(lat); const lo = Number(lng)
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
      return haversineMetres(la, lo, siteLat, siteLng)
    }

    rows.push({
      sessionId,
      userId: uid,
      employeeName: profileById.get(uid) ?? 'Unknown',
      dateMelbourne: melbourneCalendarDate(clockIn),
      signInMelbourne: melbourneHHMM(clockIn),
      signOutMelbourne: closed && clockOut ? melbourneHHMM(clockOut) : null,
      status: mapAttendanceStatus(closed, row.close_kind),
      siteName,
      durationHours: grossMin != null ? durationHoursFromMinutes(grossMin) : null,
      durationGrossMinutes: grossMin,
      durationDisplay: grossMin != null ? formatDurationHm(grossMin) : null,
      clockInDistanceMetres: calcDist(row.clock_in_lat, row.clock_in_lng),
      clockOutDistanceMetres: calcDist(row.clock_out_lat, row.clock_out_lng),
    })
  }

  rows.sort((a, b) => {
    const byName = a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' })
    if (byName !== 0) return byName
    return b.dateMelbourne.localeCompare(a.dateMelbourne) || b.signInMelbourne.localeCompare(a.signInMelbourne)
  })

  const rangeSummary = computeRangeAttendanceSummary(rows)
  const todayMelbourne = melbourneCalendarDate(new Date())
  const live = await fetchSignedInNowAndTodayCount(admin, profileById)

  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    employees,
    rows,
    dashboard: {
      todayMelbourne,
      loggedInTodayCount: live.loggedInTodayCount,
      signedInNowCount: live.signedInNow.length,
      signedInNow: live.signedInNow,
      averageHoursInRange: rangeSummary.averageHoursInRange,
      averageDurationDisplay: rangeSummary.averageDurationDisplay,
      missingSignOutsInRange: rangeSummary.missingSignOutsInRange,
    },
  }
}
