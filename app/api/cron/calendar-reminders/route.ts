import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import {
  notifyCalendarReminder24h,
  notifyCalendarReminder2h,
} from '@/lib/notifications/portalGraphNotifications'

export const runtime = 'nodejs'
// Allow up to 60 s — email sending can be slow when multiple events fire at once.
export const maxDuration = 60

/**
 * Scans upcoming calendar events and dispatches reminder emails.
 * Runs once daily at 06:00 AEST (20:00 UTC) via vercel.json.
 *
 * Strategy (date-based, compatible with Hobby plan daily cron):
 *  - 24-hour reminder → events scheduled for TOMORROW (Melbourne date)
 *  - Morning-of reminder → events scheduled for TODAY (Melbourne date)
 *
 * The `reminder_24h_sent_at` / `reminder_2h_sent_at` columns act as idempotency
 * flags so retries or manual triggers never double-send.
 *
 * Secured with `CRON_SECRET` (Authorization: Bearer <secret>).
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

    // Melbourne calendar dates for today and tomorrow
    const todayMelb = melbourneCalendarDate(now)
    const tomorrowMelb = melbourneCalendarDate(new Date(now.getTime() + 24 * 60 * 60 * 1000))

    const { data: events, error: evErr } = await supabase
      .from('calendar_events')
      .select(
        'id, title, description, date, start_time, assigned_to, created_by, ' +
        'location_text, location_id, reminder_24h_sent_at, reminder_2h_sent_at',
      )
      .in('date', [todayMelb, tomorrowMelb])
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
            String(
              l.Company_address ?? l.address ?? l.site_address ??
              l.location_name ?? l.name ?? l.suburb ?? l.site_name ?? ''
            ).trim() || null
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

      // ── 24-hour reminder: events happening TOMORROW ───────────────────────
      if (!row.reminder_24h_sent_at && eventDate === tomorrowMelb) {
        // Optimistic flag to prevent double-send
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
          // Revert flag so the next run can retry
          await supabase
            .from('calendar_events')
            .update({ reminder_24h_sent_at: null })
            .eq('id', String(row.id))
        } else {
          sent24h++
        }
      }

      // ── Morning-of reminder: events happening TODAY ───────────────────────
      if (!row.reminder_2h_sent_at && eventDate === todayMelb) {
        const { error: upErr } = await supabase
          .from('calendar_events')
          .update({ reminder_2h_sent_at: now.toISOString() })
          .eq('id', String(row.id))
          .is('reminder_2h_sent_at', null)

        if (upErr) {
          errors.push(`morning flag update failed for ${String(row.id)}: ${upErr.message}`)
          continue
        }

        const result = await notifyCalendarReminder2h(supabase, sharedParams)
        if (result.status === 'failed') {
          errors.push(`morning email failed for ${String(row.id)}: ${result.error}`)
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
