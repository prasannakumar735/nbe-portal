import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { jsonError500 } from '@/lib/security/safeApiError'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'
import {
  isForgottenOfficeSessionSyntheticEligible,
  runForgottenSyntheticCloseForSession,
} from '@/lib/officeClock/forgottenSyntheticClose'
import type { ProfileFromTable } from '@/lib/auth/roles'

export const runtime = 'nodejs'

/**
 * Allows the signed-in portal user (non-client) to close their **own** open office attendance
 * session using the forgotten synthetic schedule when eligibility matches (prior Melbourne calendar
 * day, or today after 17:00 Melbourne).
 *
 * Complements cron + covers localhost/dev where CRON_SECRET jobs never run.
 */
export async function POST() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profileRow?.role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const profile = profileRow as ProfileFromTable | null

    const { data: session, error: sessErr } = await supabase
      .from('office_attendance_sessions')
      .select('id, site_id, clock_in_at, clock_out_at, timesheet_entry_id')
      .eq('user_id', user.id)
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessErr) {
      console.error('[resolve-self-forgotten] session', sessErr)
      return NextResponse.json({ error: 'Could not load attendance.' }, { status: 500 })
    }

    const sess = session as Record<string, unknown> | null
    if (!sess) {
      return NextResponse.json({ ok: true, resolved: false })
    }

    if (sess.timesheet_entry_id) {
      return NextResponse.json({ ok: true, resolved: false })
    }

    const clockInAt = new Date(String(sess.clock_in_at))
    const now = new Date()
    if (!isForgottenOfficeSessionSyntheticEligible(clockInAt, now)) {
      return NextResponse.json({ ok: true, resolved: false })
    }

    const { data: site, error: siteErr } = await supabase
      .from('office_clock_sites')
      .select('*')
      .eq('id', String(sess.site_id))
      .maybeSingle()

    if (siteErr || !site) {
      return NextResponse.json({ error: 'Office site not found.' }, { status: 500 })
    }

    const siteRow = await resolveOfficeSiteRowFully(supabase, site as Record<string, unknown>)
    if (!isOfficeSiteRowConfigured(siteRow)) {
      return NextResponse.json(
        {
          error:
            'Office site is not configured for timesheets. Set office_clock_sites or OFFICE_CLOCK_* env vars.',
        },
        { status: 503 },
      )
    }

    const result = await runForgottenSyntheticCloseForSession(supabase, {
      sessionId: String(sess.id),
      userId: user.id,
      profile,
      clockInAt,
      siteRow,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      resolved: true,
      closedDate: result.closedDate,
      message:
        `Your unattended office session for ${result.closedDate} was closed automatically (7:00–16:00 Melbourne, break 30 min). Check your timecard.`,
    })
  } catch (e) {
    return jsonError500(e, 'office-clock-resolve-self-forgotten')
  }
}
