import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isOfficeSiteRowConfigured, resolveOfficeSiteRowFully } from '@/lib/officeClock/envSiteFallback'
import { assertJsonContentLength, PayloadTooLargeError } from '@/lib/security/httpRequestLimits'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

type Body = { siteSlug?: string }

export async function POST(request: NextRequest) {
  try {
    assertJsonContentLength(request, 4096)
    const raw = (await request.json().catch(() => null)) as Body | null
    const siteSlug = typeof raw?.siteSlug === 'string' ? raw.siteSlug.trim().toLowerCase() : ''
    if (!siteSlug) {
      return NextResponse.json({ error: 'siteSlug is required.' }, { status: 400 })
    }

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

    const { data: site, error: siteErr } = await supabase
      .from('office_clock_sites')
      .select('*')
      .eq('slug', siteSlug)
      .eq('is_active', true)
      .maybeSingle()

    if (siteErr || !site) {
      return NextResponse.json({ error: 'Unknown or inactive site.' }, { status: 404 })
    }

    const s = await resolveOfficeSiteRowFully(supabase, site as Record<string, unknown>)
    if (!isOfficeSiteRowConfigured(s)) {
      return NextResponse.json(
        {
          error:
            'This office site is not fully configured (client, location, work types). Update row `office_clock_sites` for this slug in Supabase, or set OFFICE_CLOCK_CLIENT_ID, OFFICE_CLOCK_LOCATION_ID, OFFICE_CLOCK_WORK_TYPE_LEVEL1_ID, OFFICE_CLOCK_WORK_TYPE_LEVEL2_ID in .env.local.',
        },
        { status: 503 },
      )
    }

    const { data: open, error: openErr } = await supabase
      .from('office_attendance_sessions')
      .select('id')
      .eq('user_id', user.id)
      .is('clock_out_at', null)
      .maybeSingle()

    if (openErr) {
      console.error('[POST /api/office-clock/in] open check', openErr)
      return NextResponse.json({ error: 'Could not check attendance state.' }, { status: 500 })
    }
    if (open?.id) {
      return NextResponse.json(
        { error: 'You are already signed in. Sign out before signing in again.' },
        { status: 409 },
      )
    }

    const { data: inserted, error: insErr } = await supabase
      .from('office_attendance_sessions')
      .insert({
        user_id: user.id,
        site_id: String(s.id),
        clock_in_at: new Date().toISOString(),
      })
      .select('id, clock_in_at')
      .single()

    if (insErr || !inserted) {
      if (insErr?.code === '23505') {
        return NextResponse.json(
          { error: 'You are already signed in. Sign out before signing in again.' },
          { status: 409 },
        )
      }
      console.error('[POST /api/office-clock/in]', insErr)
      return NextResponse.json({ error: 'Could not record sign in.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      sessionId: String((inserted as { id: string }).id),
      clockInAt: String((inserted as { clock_in_at: string }).clock_in_at),
    })
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }
    return jsonError500(e, 'office-clock-in')
  }
}
