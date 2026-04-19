import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { notifyTimesheetSubmittedEmail } from '@/lib/notifications/portalGraphNotifications'
import type { PortalNotifyResult } from '@/lib/notifications/portalGraphNotifications'
import { weekEndFromStart } from '@/lib/timecard/weekDates'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { weekStart?: string }
    const weekStart = String(body.weekStart ?? '').trim()
    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sheet, error: findErr } = await supabase
      .from('employee_weekly_timesheets')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (findErr) {
      throw findErr
    }
    if (!sheet) {
      return NextResponse.json({ error: 'No timesheet for this week' }, { status: 404 })
    }
    if (sheet.status !== 'draft' && sheet.status !== 'rejected') {
      return NextResponse.json({ error: 'Timesheet is not editable' }, { status: 409 })
    }

    const { data: updated, error: upErr } = await supabase
      .from('employee_weekly_timesheets')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        rejected_at: null,
        rejected_by: null,
      })
      .eq('id', sheet.id)
      .select()
      .single()

    if (upErr) {
      throw upErr
    }

    /** Notify managers + service inbox (Microsoft Graph). Failure does not roll back submit. */
    let notification: PortalNotifyResult | undefined
    try {
      const admin = createServiceRoleClient()
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('id', user.id)
        .maybeSingle()

      const p = profile as Record<string, unknown> | null
      const employeeDisplayName =
        String(p?.full_name ?? '').trim() ||
        [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
        user.email?.split('@')[0] ||
        'Employee'

      notification = await notifyTimesheetSubmittedEmail(admin, {
        employeeId: user.id,
        employeeDisplayName,
        weekStartDate: weekStart,
        weekEndDate: weekEndFromStart(weekStart),
      })

      if (notification.status === 'failed') {
        console.error('[POST /api/timecard/submit] notifyTimesheetSubmittedEmail:', notification.error)
      }
    } catch (notifyErr) {
      console.error('[POST /api/timecard/submit] notification exception:', notifyErr)
      notification = {
        status: 'failed',
        error: notifyErr instanceof Error ? notifyErr.message : 'Notification failed.',
      }
    }

    return NextResponse.json({ timesheet: updated, notification })
  } catch (e) {
    console.error('[POST /api/timecard/submit]', e)
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 })
  }
}
