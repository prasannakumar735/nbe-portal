import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { notifyCalendarEventAssignedEmail } from '@/lib/notifications/portalGraphNotifications'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requireUser } from '@/lib/security/requireUser'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const serverAuth = await createServerClient()
    const user = await requireUser(serverAuth)

    const body = (await request.json()) as { event_id?: string }
    const eventId = String(body.event_id ?? '').trim()
    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: ev, error: evErr } = await supabase
      .from('calendar_events')
      .select(
        'id, assigned_to, created_by, title, date, start_time, is_full_day, location_text, client_id, location_id',
      )
      .eq('id', eventId)
      .maybeSingle()

    if (evErr || !ev) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const row = ev as Record<string, unknown>
    if (String(row.created_by) !== user.id) {
      return NextResponse.json({ error: 'Only the event creator can trigger this notification' }, { status: 403 })
    }

    if (String(row.assigned_to) === String(row.created_by)) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Self-assigned event' })
    }

    let locationLabel: string | null = String(row.location_text ?? '').trim() || null
    const locId = row.location_id ? String(row.location_id) : null
    if (!locationLabel && locId) {
      const { data: loc } = await supabase
        .from('client_locations')
        .select('location_name, name, suburb, site_name')
        .eq('id', locId)
        .maybeSingle()
      if (loc) {
        const l = loc as Record<string, unknown>
        locationLabel =
          String(l.location_name ?? l.name ?? l.suburb ?? l.site_name ?? '').trim() || null
      }
    }

    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle()

    const cp = creatorProfile as Record<string, unknown> | null
    const creatorDisplayName =
      String(cp?.full_name ?? '').trim() ||
      [cp?.first_name, cp?.last_name].filter(Boolean).join(' ').trim() ||
      user.email?.split('@')[0] ||
      'Manager'

    const result = await notifyCalendarEventAssignedEmail(supabase, {
      assigneeUserId: String(row.assigned_to),
      creatorDisplayName,
      title: String(row.title ?? 'Event'),
      date: String(row.date ?? ''),
      startTime: row.start_time ? String(row.start_time) : null,
      isFullDay: Boolean(row.is_full_day),
      locationLabel,
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

    return NextResponse.json({ success: true, notification: result })
  } catch (e) {
    const auth = unauthorizedOrForbiddenResponse(e)
    if (auth) return auth
    return jsonError500(e, 'calendar-event-assigned-notification')
  }
}
