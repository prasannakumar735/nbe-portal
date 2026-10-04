import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'
import { resolveAttendanceDateRange } from '@/lib/officeClock/attendanceRange'
import { fetchManagerAttendance } from '@/lib/officeClock/fetchManagerAttendance'



const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Manager office QR attendance. Uses service role after fetchIsManagerOrAdmin (RLS is own-row only).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await fetchIsManagerOrAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sp = request.nextUrl.searchParams
    const range = resolveAttendanceDateRange(sp.get('dateFrom'), sp.get('dateTo'))
    if (!range.ok) {
      return NextResponse.json({ error: range.message }, { status: 400 })
    }

    const userIdRaw = sp.get('userId')?.trim() || null
    if (userIdRaw && !UUID_RE.test(userIdRaw)) {
      return NextResponse.json({ error: 'Invalid userId.' }, { status: 400 })
    }

    const admin = createServiceRoleClient()
    const result = await fetchManagerAttendance(admin, {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      userId: userIdRaw,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[GET /api/manager/office-attendance]', e)
    return NextResponse.json({ error: 'Failed to load attendance.' }, { status: 500 })
  }
}
