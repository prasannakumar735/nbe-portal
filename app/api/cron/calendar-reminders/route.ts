import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'
import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import {
  notifyCalendarReminder24h,
  notifyCalendarReminder2h,
} from '@/lib/notifications/portalGraphNotifications'
import { isCalendarNotificationsDisabled } from '@/lib/notifications/isCalendarNotificationsDisabled'

export const runtime = 'nodejs'
export const maxDuration = 60

type ProfileMinimal = Record<string, unknown>

function uniqIds(ids: string[]): string[] {
  return [...new Set(ids.map(x => x.trim()).filter(Boolean))]
}

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET?.trim()
    const auth = request.headers.get('authorization')?.trim() ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isCalendarNotificationsDisabled()) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'notifications disabled (local testing)',
      })
    }

    const supabase = createServiceRoleClient()
    const now = new Date()

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

    const eventIds = [...new Set((rows as unknown as Record<string, unknown>[]).map(r => String(r.id ?? '').trim()))].filter(
      Boolean,
    )

    const assigneesByEvent = new Map<string, string[]>()

    try {
      if (eventIds.length > 0) {
        const { data: assigns } = await supabase.from('calendar_event_assignees').select('event_id,user_id').in('event_id', eventIds)
        for (const raw of assigns ?? []) {
          const pair = raw as unknown as Record<string, unknown>
          const eid = String(pair.event_id ?? '')
          const uid = String(pair.user_id ?? '')
          if (!eid || !uid) continue
          assigneesByEvent.set(eid, uniqIds([...(assigneesByEvent.get(eid) ?? []), uid]))
        }
      }
    } catch (e) {
      console.warn('[calendar-reminders] assignee lookup fallback', e)
    }

    const resolveAssigneeIds = (rowId: unknown, fallbackAssigned?: unknown): string[] => {
      const id = String(rowId ?? '').trim()
      const fromJoin = assigneesByEvent.get(id)
      if (fromJoin?.length) return fromJoin
      const a = fallbackAssigned ? String(fallbackAssigned) : ''
      return a ? [a] : []
    }

    /** Collect profiles for reminder salutation lines. */
    const allRecipientIds = new Set<string>()
    for (const ev of rows) {
      const r = ev as unknown as Record<string, unknown>
      for (const uid of resolveAssigneeIds(r.id, r.assigned_to)) allRecipientIds.add(uid)
    }
    let nameByUserId = new Map<string, string>()
    if (allRecipientIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', [...allRecipientIds])
      for (const p of profiles ?? []) {
        const pr = p as ProfileMinimal
        const id = String(pr.id ?? '')
        if (!id) continue
        const name =
          String(pr.full_name ?? '').trim() ||
          [pr.first_name, pr.last_name].filter(Boolean).join(' ').trim() ||
          'there'
        nameByUserId.set(id, name)
      }
    }

    async function attachLocationLabel(ev: Record<string, unknown>): Promise<string | null> {
      let locationLabel = String(ev.location_text ?? '').trim() || null
      const locId = ev.location_id ? String(ev.location_id) : null
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
              l.Company_address ?? l.address ?? l.site_address ?? l.location_name ?? l.name ?? l.suburb ?? l.site_name ?? '',
            ).trim() || null
        }
      }
      return locationLabel
    }

    let sent24h = 0
    let sent2h = 0
    const errors: string[] = []

    for (const ev of rows) {
      const row = ev as unknown as Record<string, unknown>
      const eventDate = String(row.date ?? '').trim()
      const startTimeRaw = String(row.start_time ?? '').trim()
      if (!eventDate || !startTimeRaw) continue

      const assigneeIds = resolveAssigneeIds(row.id, row.assigned_to)
      if (!assigneeIds.length) continue

      const sharedLocation = await attachLocationLabel(row)

      const sharedBase = {
        title: String(row.title ?? 'Event'),
        date: eventDate,
        startTime: startTimeRaw.slice(0, 5),
        locationLabel: sharedLocation,
        description: row.description ? String(row.description) : null,
      }

      if (!row.reminder_24h_sent_at && eventDate === tomorrowMelb) {
        const { error: upErr } = await supabase
          .from('calendar_events')
          .update({ reminder_24h_sent_at: now.toISOString() })
          .eq('id', String(row.id))
          .is('reminder_24h_sent_at', null)

        if (upErr) {
          errors.push(`24h flag update failed for ${String(row.id)}: ${upErr.message}`)
          continue
        }

        let ok = true
        for (const uid of assigneeIds) {
          const assigneeName = nameByUserId.get(uid) ?? 'there'
          const result = await notifyCalendarReminder24h(supabase, {
            ...sharedBase,
            assigneeUserId: uid,
            assigneeName,
          })
          if (result.status === 'failed') {
            errors.push(`24h email failed for ${String(row.id)} / ${uid}: ${result.error}`)
            ok = false
            break
          }
        }

        if (!ok) {
          await supabase
            .from('calendar_events')
            .update({ reminder_24h_sent_at: null })
            .eq('id', String(row.id))
        } else {
          sent24h++
        }
      }

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

        let ok = true
        for (const uid of assigneeIds) {
          const assigneeName = nameByUserId.get(uid) ?? 'there'
          const result = await notifyCalendarReminder2h(supabase, {
            ...sharedBase,
            assigneeUserId: uid,
            assigneeName,
          })
          if (result.status === 'failed') {
            errors.push(`morning email failed for ${String(row.id)} / ${uid}: ${result.error}`)
            ok = false
            break
          }
        }

        if (!ok) {
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
