import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertJsonContentLength, PayloadTooLargeError } from '@/lib/security/httpRequestLimits'
import { jsonError500 } from '@/lib/security/safeApiError'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'
import {
  melbourneCalendarDate,
  melbourneHHMM,
} from '@/lib/officeClock/melbourneWallClock'
import { timeStringToMinutes } from '@/lib/timecard/computeHours'
import {
  completeOfficeClockTimesheet,
  officeClockBreakMinutes,
} from '@/lib/officeClock/completeOfficeClockTimesheet'
import type { ProfileFromTable } from '@/lib/auth/roles'

export const runtime = 'nodejs'

type Body = { workTypeLevel2Id?: string | null }

export async function POST(request: Request) {
  try {
    assertJsonContentLength(request, 4096)
    const raw = (await request.json().catch(() => ({}))) as Body

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
      console.error('[POST /api/office-clock/out] session', sessErr)
      return NextResponse.json({ error: 'Could not load attendance.' }, { status: 500 })
    }
    if (!session) {
      return NextResponse.json({ error: 'You are not signed in. Scan the office QR and sign in first.' }, { status: 400 })
    }

    const sess = session as Record<string, unknown>
    if (sess.timesheet_entry_id) {
      return NextResponse.json({ ok: true, message: 'Already recorded for this session.' })
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
            'Office site is not configured for timesheets. Set columns on office_clock_sites or OFFICE_CLOCK_* env vars.',
        },
        { status: 503 },
      )
    }

    const clockInAt = new Date(String(sess.clock_in_at))
    const clockOutAt = new Date()
    if (Number.isNaN(clockInAt.getTime())) {
      return NextResponse.json({ error: 'Invalid sign-in time.' }, { status: 500 })
    }

    const dateIn = melbourneCalendarDate(clockInAt)
    const dateOut = melbourneCalendarDate(clockOutAt)
    if (dateIn !== dateOut) {
      return NextResponse.json(
        {
          error:
            'Sign out must be the same calendar day as sign in (Melbourne time). If you forgot to sign out, ask a manager to adjust your timesheet.',
        },
        { status: 400 },
      )
    }

    const entryDate = dateIn
    const startTime = melbourneHHMM(clockInAt)
    const endTime = melbourneHHMM(clockOutAt)
    const rawBreak = Number(siteRow.default_break_minutes ?? 30) || 0

    const startM = timeStringToMinutes(startTime)
    const endM = timeStringToMinutes(endTime)
    if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
      return NextResponse.json(
        { error: 'Sign out time must be after sign in time on the same day.' },
        { status: 400 },
      )
    }

    const breakMinutes = officeClockBreakMinutes(rawBreak, startTime, endTime)

    const workTypeLevel2IdFromBody =
      typeof raw.workTypeLevel2Id === 'string' || raw.workTypeLevel2Id === null
        ? raw.workTypeLevel2Id
        : undefined

    const done = await completeOfficeClockTimesheet({
      supabase,
      userId: user.id,
      profile,
      sessionId: String(sess.id),
      siteRow,
      clockInActual: clockInAt,
      clockOutInstant: clockOutAt,
      entryDate,
      startTimeMelbourne: startTime,
      endTimeMelbourne: endTime,
      breakMinutes,
      workTypeLevel2IdFromBody,
    })

    if (!done.ok) {
      return NextResponse.json({ error: done.message }, { status: done.status })
    }

    return NextResponse.json({
      ok: true,
      timesheetEntryId: done.timesheetEntryId,
      entryDate: done.entryDate,
      startTime: done.startTime,
      endTime: done.endTime,
      totalHours: done.totalHours,
    })
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }
    return jsonError500(e, 'office-clock-out')
  }
}
