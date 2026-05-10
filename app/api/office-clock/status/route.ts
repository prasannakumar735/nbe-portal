import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isTechnician } from '@/lib/auth/roles'

export const runtime = 'nodejs'

export async function GET() {
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

  const technician = isTechnician(profile)

  const { data: session, error } = await supabase
    .from('office_attendance_sessions')
    .select('id, clock_in_at, site_id')
    .eq('user_id', user.id)
    .is('clock_out_at', null)
    .order('clock_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[GET /api/office-clock/status]', error)
    return NextResponse.json({ error: 'Failed to load status.' }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ openSession: null, isTechnician: technician, needsFabTask: technician })
  }

  const s = session as { id: string; clock_in_at: string; site_id: string }
  const { data: site } = await supabase
    .from('office_clock_sites')
    .select('slug, display_name')
    .eq('id', s.site_id)
    .maybeSingle()

  const siteRow = site as { slug?: string; display_name?: string } | null

  return NextResponse.json({
    openSession: {
      sessionId: s.id,
      clockInAt: s.clock_in_at,
      siteSlug: siteRow?.slug ?? '',
      siteDisplayName: siteRow?.display_name ?? 'Office',
    },
    isTechnician: technician,
    needsFabTask: technician,
  })
}
