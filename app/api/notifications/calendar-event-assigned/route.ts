import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { notifyCalendarEventAssignedEmail } from '@/lib/notifications/portalGraphNotifications'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requireUser } from '@/lib/security/requireUser'
import { jsonError500 } from '@/lib/security/safeApiError'
import { isCalendarNotificationsDisabled } from '@/lib/notifications/isCalendarNotificationsDisabled'

export const runtime = 'nodejs'

async function recipientUserIdsForEvent(
  service: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  fallbackAssignedTo: string | null
): Promise<string[]> {
  const { data: assigns } = await service
    .from('calendar_event_assignees')
    .select('user_id')
    .eq('event_id', eventId)
  const fromJoinRows = assigns ?? []
  const fromJoin =
    fromJoinRows.length > 0
      ? fromJoinRows.map(r => String((r as Record<string, unknown>).user_id ?? '').trim()).filter(Boolean)
      : []
  if (fromJoin.length > 0) {
    return [...new Set(fromJoin)]
  }
  const p = fallbackAssignedTo?.trim()
  return p ? [p] : []
}

export async function POST(request: NextRequest) {
  try {
    const serverAuth = await createServerClient()
    const user = await requireUser(serverAuth)

    if (isCalendarNotificationsDisabled()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'notifications disabled (local testing)',
      })
    }

    const body = (await request.json()) as { event_id?: string }
    const eventId = String(body.event_id ?? '').trim()
    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: ev, error: evErr } = await supabase
      .from('calendar_events')
      .select(
        'id, assigned_to, created_by, title, description, date, start_time, is_full_day, location_text, client_id, location_id',
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

    const assignees = await recipientUserIdsForEvent(supabase, eventId, String(row.assigned_to ?? ''))

    /** Notify every assignee who is not the creator (dedupe by id). */
    const targets = [...new Set(assignees.filter(id => id && id !== user.id))]
    if (targets.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'No recipients (self-assigned or empty)' })
    }

    let firstFailure: string | null = null
    let sent = 0
    for (const assigneeUserId of targets) {
      const result = await notifyCalendarEventAssignedEmail(supabase, {
        assigneeUserId,
        creatorDisplayName,
        title: String(row.title ?? 'Event'),
        date: String(row.date ?? ''),
        startTime: row.start_time ? String(row.start_time) : null,
        isFullDay: Boolean(row.is_full_day),
        locationLabel,
        description: row.description ? String(row.description) : null,
      })
      if (result.status === 'failed' && !firstFailure) firstFailure = result.error
      if (result.status === 'sent') sent += result.recipients
    }

    if (firstFailure) {
      return NextResponse.json(
        {
          error: process.env.NODE_ENV === 'production' ? 'Notification could not be sent.' : firstFailure,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, notified: targets.length, sent })
  } catch (e) {
    const auth = unauthorizedOrForbiddenResponse(e)
    if (auth) return auth
    return jsonError500(e, 'calendar-event-assigned-notification')
  }
}
