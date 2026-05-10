import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'

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

  const { data, error } = await supabase
    .from('office_clock_sites')
    .select(
      'id, slug, display_name, client_id, location_id, work_type_level1_id, work_type_level2_id, technician_default_work_type_level2_id, default_break_minutes, default_task, billable',
    )
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  if (error) {
    console.error('[GET /api/office-clock/sites]', error)
    return NextResponse.json({ error: 'Failed to load sites.' }, { status: 500 })
  }

  const sites = await Promise.all(
    (data ?? []).map(async row => {
      const r = await resolveOfficeSiteRowFully(supabase, row as Record<string, unknown>)
      const configured = isOfficeSiteRowConfigured(r)
      return {
        id: String(r.id),
        slug: String(r.slug),
        displayName: String(r.display_name ?? r.slug),
        defaultBreakMinutes: Number(r.default_break_minutes ?? 30) || 30,
        defaultTask: r.default_task != null ? String(r.default_task) : null,
        billable: Boolean(r.billable),
        configured,
      }
    }),
  )

  return NextResponse.json({ sites })
}
