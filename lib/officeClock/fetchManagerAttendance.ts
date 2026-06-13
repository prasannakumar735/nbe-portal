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
      'id, user_id, clock_in_at, clock_out_at, close_kind, site_id, office_clock_sites(display_name, slug)',
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
      .select('id, user_id, clock_in_at, clock_out_at, close_kind, site_id')
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
  if (siteIds.length > 0) {
    const { data: sites } = await admin
      .from('office_clock_sites')
      .select('id, display_name')
      .in('id', siteIds)
    for (const s of sites ?? []) {
      const row = s as { id: string; display_name?: string }
      siteNameById.set(String(row.id), String(row.display_name ?? '').trim() || 'Unknown site')
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
