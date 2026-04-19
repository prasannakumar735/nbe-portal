import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { notifyTimesheetSubmittedEmail } from '@/lib/notifications/portalGraphNotifications'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requireUser } from '@/lib/security/requireUser'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const serverAuth = await createServerClient()
    const user = await requireUser(serverAuth)

    const body = (await request.json()) as { submission_id?: string }
    const submissionId = String(body.submission_id ?? '').trim()
    if (!submissionId) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: sub, error: subErr } = await supabase
      .from('weekly_submissions')
      .select('id, employee_id, week_start_date, week_end_date, status')
      .eq('id', submissionId)
      .maybeSingle()

    if (subErr || !sub) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (String(sub.employee_id) !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (String(sub.status) !== 'submitted') {
      return NextResponse.json(
        { error: `Submission must be submitted (got ${String(sub.status)})` },
        { status: 400 },
      )
    }

    const { data: profile } = await supabase
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

    const result = await notifyTimesheetSubmittedEmail(supabase, {
      employeeId: user.id,
      employeeDisplayName,
      weekStartDate: String(sub.week_start_date),
      weekEndDate: String(sub.week_end_date),
    })

    if (result.status === 'failed') {
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === 'production'
              ? 'Notification could not be sent.'
              : result.error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      notification: result,
    })
  } catch (e) {
    const auth = unauthorizedOrForbiddenResponse(e)
    if (auth) return auth
    return jsonError500(e, 'timesheet-submitted-notification')
  }
}
