import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { submitWeeklyTimesheet } from '@/lib/timecard/submitWeeklyTimesheet'
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

    const admin = createServiceRoleClient()
    const result = await submitWeeklyTimesheet(admin, {
      userId: user.id,
      weekStart,
      mode: 'employee',
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status })
    }

    const updated = result.sheet

    return NextResponse.json({ timesheet: updated })
  } catch (e) {
    console.error('[POST /api/timecard/submit]', e)
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 })
  }
}
