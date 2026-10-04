import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'
import { processForgottenOfficeSessionClose } from '@/lib/officeClock/forgottenSyntheticClose'
import type { ProfileFromTable } from '@/lib/auth/roles'



/**
 * Allows the signed-in portal user (non-client) to close their **own** open office attendance
 * session using the forgotten synthetic schedule when eligibility matches.
 * Uses service role for close steps (same as cron).
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
    if (Number.isNaN(clockInAt.getTime())) {
      return NextResponse.json({ error: 'Invalid sign-in time.' }, { status: 500 })
    }

    let siteRow: Record<string, unknown> | null = null
    const { data: site, error: siteErr } = await supabase
      .from('office_clock_sites')
      .select('*')
      .eq('id', String(sess.site_id))
      .maybeSingle()

    if (!siteErr && site) {
      const resolved = await resolveOfficeSiteRowFully(supabase, site as Record<string, unknown>)
      if (isOfficeSiteRowConfigured(resolved)) {
        siteRow = resolved
      }
    }

    const admin = createServiceRoleClient()
    const result = await processForgottenOfficeSessionClose(admin, {
      sessionId: String(sess.id),
      userId: user.id,
      profile,
      clockInAt,
      siteRow,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    const modeNote =
      result.mode === 'attendance_only'
        ? ' Attendance was closed at 16:00 Melbourne; add timesheet hours manually if needed.'
        : ''

    return NextResponse.json({
      ok: true,
      resolved: true,
      closedDate: result.closedDate,
      message:
        `Your unattended office session for ${result.closedDate} was closed automatically (7:00–16:00 Melbourne, break 30 min). Check your timecard.${modeNote}`,
    })
  } catch (e) {
    return jsonError500(e, 'office-clock-resolve-self-forgotten')
  }
}
