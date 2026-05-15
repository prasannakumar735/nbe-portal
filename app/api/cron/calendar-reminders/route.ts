import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'
import { melbourneCalendarDate, melbourneLocalYmdHmToUtc } from '@/lib/officeClock/melbourneWallClock'
import {
  notifyCalendarReminder24h,
  notifyCalendarReminder2h,
} from '@/lib/notifications/portalGraphNotifications'

export const runtime = 'nodejs'
// Allow up to 60 s — email sending can be slow when multiple events fire at once.
export const maxDuration = 60

/**
 * Scans upcoming calendar events and dispatches reminder emails:
 *  - 24-hour reminder: event starts 23–25 hours from now (prep checklist)
 *  - 2-hour  reminder: event starts 1.5–3 hours from now (heads-up)
 *
 * Secured with `CRON_SECRET` (Authorization: Bearer <secret>).
 * Scheduled every 30 minutes via vercel.json.
 * Uses the `reminder_24h_sent_at` / `reminder_2h_sent_at` columns as idempotency flags
 * so emails are never sent twice regardless of how often the cron fires.
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET?.trim()
    const auth = request.headers.get('authorization')?.trim() ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const now = new Date()
    const nowMs = now.getTime()

    // Reminder windows (ms from now)
    const WINDOW_24H_LOW = 23 * 60 * 60 * 1000   // 23 h
    const WINDOW_24H_HIGH = 25 * 60 * 60 * 1000  // 25 h (2-hour send window for 30-min cron cadence)
    const WINDOW_2H_LOW  =  1.5 * 60 * 60 * 1000 // 90 min
    const WINDOW_2H_HIGH =  3   * 60 * 60 * 1000 // 3 h

    // Fetch events over the next 3 Melbourne calendar days so the cron always
    // has enough data regardless of timezone offset between UTC and Melbourne.
    const dates = [0, 1, 2, 3].map(offset =>
      melbourneCalendarDate(new Date(nowMs + offset * 24 * 60 * 60 * 1000))
    )

    const { data: events, error: evErr } = await supabase
      .from('calendar_events')
      .select(
        'id, title, description, date, start_time, assigned_to, created_by, ' +
        'location_text, location_id, reminder_24h_sent_at, reminder_2h_sent_at',
      )
      .in('date', dates)
      .eq('is_full_day', false)
      .not('status', 'in', '("cancelled","completed")')
      .or('reminder_24h_sent_at.is.null,reminder_2h_sent_at.is.null')

    if (evErr) {
      console.error('[calendar-reminders] query error', evErr)
      return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
    }

    const rows = events ?? []
    if (!rows.length) {
      return NextResponse.json({ ok: true, checked: 0, sent24h: 0, sent2h: 0, errors: [] })
    }

    let sent24h = 0
    let sent2h = 0
    const errors: string[] = []

    for (const ev of rows) {
      const row = ev as unknown as Record<string, unknown>
      const eventDate = String(row.date ?? '').trim()
      const startTimeRaw = String(row.start_time ?? '').trim()
      if (!eventDate || !startTimeRaw) continue

      // Convert the Melbourne-local event start to UTC ms
      let eventUtcMs: number
      try {
        eventUtcMs = melbourneLocalYmdHmToUtc(eventDate, startTimeRaw.slice(0, 5)).getTime()
      } catch {
        errors.push(`event ${String(row.id)}: invalid date/time`)
        continue
      }

      const msUntil = eventUtcMs - nowMs

      // Resolve assignee display name
      const assigneeId = String(row.assigned_to ?? '')
      let assigneeName = 'there'
      if (assigneeId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, first_name, last_name')
          .eq('id', assigneeId)
          .maybeSingle()
        if (profile) {
          const p = profile as Record<string, unknown>
          assigneeName =
            String(p.full_name ?? '').trim() ||
            [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
            'there'
        }
      }

      // Resolve location label
      let locationLabel: string | null = String(row.location_text ?? '').trim() || null
      const locId = row.location_id ? String(row.location_id) : null
      if (!locationLabel && locId) {
        const { data: loc } = await supabase
          .from('client_locations')
          .select('location_name, name, suburb, site_name, Company_address, address, site_address')
          .eq('id', locId)
          .maybeSingle()
        if (loc) {
          const l = loc as Record<string, unknown>
          locationLabel =
            String(l.Company_address ?? l.address ?? l.site_address ?? l.location_name ?? l.name ?? l.suburb ?? l.site_name ?? '').trim() || null
        }
      }

      const sharedParams = {
        assigneeUserId: assigneeId,
        assigneeName,
        title: String(row.title ?? 'Event'),
        date: eventDate,
        startTime: startTimeRaw.slice(0, 5),
        locationLabel,
        description: row.description ? String(row.description) : null,
      }

      // ── 24-hour reminder ──────────────────────────────────────────────────
      if (!row.reminder_24h_sent_at && msUntil >= WINDOW_24H_LOW && msUntil <= WINDOW_24H_HIGH) {
        // Mark sent first (optimistic) to prevent double-send if the email call is slow
        const { error: upErr } = await supabase
          .from('calendar_events')
          .update({ reminder_24h_sent_at: now.toISOString() })
          .eq('id', String(row.id))
          .is('reminder_24h_sent_at', null)

        if (upErr) {
          errors.push(`24h flag update failed for ${String(row.id)}: ${upErr.message}`)
          continue
        }

        const result = await notifyCalendarReminder24h(supabase, sharedParams)
        if (result.status === 'failed') {
          errors.push(`24h email failed for ${String(row.id)}: ${result.error}`)
          // Revert the flag so the next cron run can retry
          await supabase
            .from('calendar_events')
            .update({ reminder_24h_sent_at: null })
            .eq('id', String(row.id))
        } else {
          sent24h++
        }
      }

      // ── 2-hour reminder ───────────────────────────────────────────────────
      if (!row.reminder_2h_sent_at && msUntil >= WINDOW_2H_LOW && msUntil <= WINDOW_2H_HIGH) {
        const { error: upErr } = await supabase
          .from('calendar_events')
          .update({ reminder_2h_sent_at: now.toISOString() })
          .eq('id', String(row.id))
          .is('reminder_2h_sent_at', null)

        if (upErr) {
          errors.push(`2h flag update failed for ${String(row.id)}: ${upErr.message}`)
          continue
        }

        const result = await notifyCalendarReminder2h(supabase, sharedParams)
        if (result.status === 'failed') {
          errors.push(`2h email failed for ${String(row.id)}: ${result.error}`)
          await supabase
            .from('calendar_events')
            .update({ reminder_2h_sent_at: null })
            .eq('id', String(row.id))
        } else {
          sent2h++
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: rows.length,
      sent24h,
      sent2h,
      errors,
    })
  } catch (e) {
    return jsonError500(e, 'calendar-reminders-cron')
  }
}
