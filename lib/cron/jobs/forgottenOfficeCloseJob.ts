import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import type { ProfileFromTable } from '@/lib/auth/roles'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import {
  isForgottenOfficeSessionSyntheticEligible,
  processForgottenOfficeSessionClose,
} from '@/lib/officeClock/forgottenSyntheticClose'

export async function runForgottenOfficeCloseJob(): Promise<Record<string, unknown>> {
  const supabase = createServiceRoleClient()
  const now = new Date()

  const { data: sessions, error: sessErr } = await supabase
    .from('office_attendance_sessions')
    .select('id, user_id, site_id, clock_in_at')
    .is('clock_out_at', null)
    .is('timesheet_entry_id', null)

  if (sessErr) {
    console.error('[auto-close-forgotten] list sessions', sessErr)
    return { ok: false, error: 'Could not list sessions.' }
  }

  const rows = sessions ?? []
  if (!rows.length) {
    return {
      ok: true,
      processed: 0,
      closedFull: 0,
      closedAttendanceOnly: 0,
      skipped: 0,
      errors: [] as string[],
    }
  }

  const userIds = [...new Set(rows.map(r => String(r.user_id)))]
  const { data: profiles } = await supabase.from('profiles').select('id, role').in('id', userIds)
  const profileMap = new Map<string, ProfileFromTable>(
    (profiles ?? []).map(p => [String(p.id), { role: p.role != null ? String(p.role) : null }]),
  )

  let closedFull = 0
  let closedAttendanceOnly = 0
  let skipped = 0
  const errors: string[] = []

  const todayMelbourne = melbourneCalendarDate(now)

  for (const row of rows) {
    const sessionId = String(row.id)
    const userId = String(row.user_id)
    const siteId = String(row.site_id)
    const clockInAt = new Date(String(row.clock_in_at))
    if (Number.isNaN(clockInAt.getTime())) {
      skipped += 1
      errors.push(`session ${sessionId}: invalid clock_in_at`)
      continue
    }

    if (!isForgottenOfficeSessionSyntheticEligible(clockInAt, now)) {
      skipped += 1
      continue
    }

    let siteRow: Record<string, unknown> | null = null
    const { data: site, error: siteErr } = await supabase
      .from('office_clock_sites')
      .select('*')
      .eq('id', siteId)
      .maybeSingle()

    if (!siteErr && site) {
      const resolved = await resolveOfficeSiteRowFully(supabase, site as Record<string, unknown>)
      if (isOfficeSiteRowConfigured(resolved)) {
        siteRow = resolved
      }
    }

    const profile = profileMap.get(userId) ?? null

    const result = await processForgottenOfficeSessionClose(supabase, {
      sessionId,
      userId,
      profile,
      clockInAt,
      siteRow,
      now,
    })

    if (!result.ok) {
      skipped += 1
      errors.push(`session ${sessionId}: ${result.message}`)
      continue
    }

    if (result.mode === 'full') {
      closedFull += 1
    } else {
      closedAttendanceOnly += 1
      if (result.timesheetError) {
        errors.push(`session ${sessionId}: timesheet skipped — ${result.timesheetError}`)
      }
    }
  }

  return {
    ok: true,
    processed: rows.length,
    closed: closedFull + closedAttendanceOnly,
    closedFull,
    closedAttendanceOnly,
    skipped,
    errors,
    melbourneCalendarDateToday: todayMelbourne,
  }
}
