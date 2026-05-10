import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import type { ProfileFromTable } from '@/lib/auth/roles'
import {
  isForgottenOfficeSessionSyntheticEligible,
  runForgottenSyntheticCloseForSession,
} from '@/lib/officeClock/forgottenSyntheticClose'

export const runtime = 'nodejs'

/**
 * Processes open office attendance sessions eligible for synthetic "forgotten sign-out".
 *
 * **Eligibility** (Melbourne calendar / wall clock, see `isForgottenOfficeSessionSyntheticEligible`):
 * - clock-in **before today's** Melbourne calendar day → backlog close anytime (sessions left open overnight).
 * - clock-in **same day** → only after **17:00 Melbourne** that day (withholds payroll line until cutoff).
 *
 * Synthetic line uses **Melbourne calendar date of clock_in**, 07:00–16:00, break 30.
 *
 * Secure with CRON_SECRET: `Authorization: Bearer <CRON_SECRET>` (vercel.json).
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET?.trim()
    const auth = request.headers.get('authorization')?.trim() ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const now = new Date()

    const { data: sessions, error: sessErr } = await supabase
      .from('office_attendance_sessions')
      .select('id, user_id, site_id, clock_in_at')
      .is('clock_out_at', null)
      .is('timesheet_entry_id', null)

    if (sessErr) {
      console.error('[auto-close-forgotten] list sessions', sessErr)
      return NextResponse.json({ error: 'Could not list sessions.' }, { status: 500 })
    }

    const rows = sessions ?? []
    if (!rows.length) {
      return NextResponse.json({ ok: true, processed: 0, closed: 0, skipped: 0, errors: [] as string[] })
    }

    const userIds = [...new Set(rows.map(r => String(r.user_id)))]
    const { data: profiles } = await supabase.from('profiles').select('id, role').in('id', userIds)
    const profileMap = new Map<string, ProfileFromTable>(
      (profiles ?? []).map(p => [String(p.id), { role: p.role != null ? String(p.role) : null }]),
    )

    let closed = 0
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

      const { data: site, error: siteErr } = await supabase
        .from('office_clock_sites')
        .select('*')
        .eq('id', siteId)
        .maybeSingle()

      if (siteErr || !site) {
        skipped += 1
        errors.push(`session ${sessionId}: site not found`)
        continue
      }

      const siteRow = await resolveOfficeSiteRowFully(supabase, site as Record<string, unknown>)
      if (!isOfficeSiteRowConfigured(siteRow)) {
        skipped += 1
        errors.push(`session ${sessionId}: site not configured`)
        continue
      }

      const profile = profileMap.get(userId) ?? null

      const result = await runForgottenSyntheticCloseForSession(supabase, {
        sessionId,
        userId,
        profile,
        clockInAt,
        siteRow,
      })

      if (!result.ok) {
        skipped += 1
        errors.push(`session ${sessionId}: ${result.message}`)
        continue
      }

      closed += 1
    }

    return NextResponse.json({
      ok: true,
      processed: rows.length,
      closed,
      skipped,
      errors,
      melbourneCalendarDateToday: todayMelbourne,
    })
  } catch (e) {
    return jsonError500(e, 'office-clock-auto-close-forgotten')
  }
}
