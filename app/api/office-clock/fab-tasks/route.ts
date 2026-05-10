import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { jsonError500 } from '@/lib/security/safeApiError'
import { listFabLevel2TasksSorted } from '@/lib/officeClock/fabWorkTypes'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tasks = await listFabLevel2TasksSorted(supabase)
    return NextResponse.json({ tasks })
  } catch (e) {
    return jsonError500(e, 'office-clock-fab-tasks')
  }
}
