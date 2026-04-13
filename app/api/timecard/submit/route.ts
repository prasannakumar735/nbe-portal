import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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

    return NextResponse.json({ timesheet: updated })
  } catch (e) {
    console.error('[POST /api/timecard/submit]', e)
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 })
  }
}
