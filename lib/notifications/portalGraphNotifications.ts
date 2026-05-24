import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'
import { getManagerPlusServiceRecipients, isValidEmail } from '@/lib/notifications/managerRecipients'
import { isCalendarNotificationsDisabled } from '@/lib/notifications/isCalendarNotificationsDisabled'

export type PortalNotifyResult =
  | { status: 'sent'; recipients: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

/**
 * Notify managers/service when an employee submits a weekly timesheet (Graph).
 */
export async function notifyTimesheetSubmittedEmail(
  supabase: SupabaseClient,
  params: {
    employeeId: string
    employeeDisplayName: string
    weekStartDate: string
    weekEndDate: string
  },
): Promise<PortalNotifyResult> {
  const { employeeDisplayName, weekStartDate, weekEndDate } = params
  const dashboardUrl = `${publicAppBaseUrl()}/dashboard/timecards?tab=team`

  let recipients: Array<{ email: string; full_name: string | null }>
  try {
    recipients = await getManagerPlusServiceRecipients(supabase)
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Recipient lookup failed.' }
  }

  if (recipients.length === 0) {
    return { status: 'skipped', reason: 'No manager/admin or service recipients.' }
  }

  const subject = 'Timesheet submitted for review'
  try {
    for (const r of recipients) {
      const name = String(r.full_name ?? '').trim() || 'there'
      const html = [
        `Hi ${escapeHtml(name)},<br/><br/>`,
        `<b>${escapeHtml(employeeDisplayName)}</b> submitted a timesheet for the week:<br/>`,
        `${escapeHtml(weekStartDate)} – ${escapeHtml(weekEndDate)}<br/><br/>`,
        `Please review in the NBE Portal.<br/><br/>`,
        `<a href="${escapeHtml(dashboardUrl)}">Open timecards</a><br/><br/>`,
        `— NBE Portal`,
      ].join('')

      await sendMailViaGraph({
        to: r.email,
        subject,
        bodyHtml: html,
      })
    }
    return { status: 'sent', recipients: recipients.length }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}

/**
 * Notify assignee when a manager (or other user) creates a calendar event assigned to them.
 */
export async function notifyCalendarEventAssignedEmail(
  supabase: SupabaseClient,
  params: {
    assigneeUserId: string
    creatorDisplayName: string
    title: string
    date: string
    startTime: string | null
    isFullDay: boolean
    locationLabel: string | null
    description?: string | null
  },
): Promise<PortalNotifyResult> {
  if (isCalendarNotificationsDisabled()) {
    return { status: 'skipped', reason: 'notifications disabled (local testing)' }
  }

  const { assigneeUserId, creatorDisplayName, title, date, startTime, isFullDay, locationLabel, description } =
    params

  const { data: userData, error } = await supabase.auth.admin.getUserById(assigneeUserId)
  if (error) {
    return { status: 'failed', error: error.message }
  }
  const email = String(userData.user?.email ?? '').trim()
  if (!isValidEmail(email)) {
    return { status: 'skipped', reason: 'Assignee has no valid email in Auth.' }
  }

  const calendarUrl = `${publicAppBaseUrl()}/calendar`
  const timeLine = isFullDay
    ? 'All day'
    : startTime
      ? formatTimeForEmail(startTime)
      : '—'
  const loc = escapeHtml(locationLabel?.trim() || '—')
  const notes = description?.trim()

  const subject = `New calendar event assigned to you: ${title.slice(0, 60)}`
  const html = buildEmailHtml({
    preheader: `${creatorDisplayName} has assigned you to "${title}" on ${formatDateForEmail(date)}`,
    accentColour: '#2563eb',
    body: `
      <p style="margin:0 0 16px">Hi,</p>
      <p style="margin:0 0 16px">
        <strong>${escapeHtml(creatorDisplayName)}</strong> has assigned you to a new calendar event.
      </p>
      ${eventDetailsTable({ title, date, time: timeLine, location: loc, rawLocation: locationLabel })}
      ${notes ? `<p style="margin:16px 0 4px"><strong>Manager notes:</strong></p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:4px">${escapeHtml(notes)}</p>` : ''}
      <p style="margin:24px 0 0">
        <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none">View calendar</a>
      </p>
    `,
  })

  try {
    await sendMailViaGraph({ to: email, subject, bodyHtml: html })
    return { status: 'sent', recipients: 1 }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}

/**
 * 24-hour advance reminder: sent the day before the event.
 */
export async function notifyCalendarReminder24h(
  supabase: SupabaseClient,
  params: {
    assigneeUserId: string
    assigneeName: string
    title: string
    date: string
    startTime: string
    locationLabel: string | null
    description: string | null
  },
): Promise<PortalNotifyResult> {
  if (isCalendarNotificationsDisabled()) {
    return { status: 'skipped', reason: 'notifications disabled (local testing)' }
  }

  const { assigneeUserId, assigneeName, title, date, startTime, locationLabel, description } = params

  const { data: userData, error } = await supabase.auth.admin.getUserById(assigneeUserId)
  if (error) return { status: 'failed', error: error.message }
  const email = String(userData.user?.email ?? '').trim()
  if (!isValidEmail(email)) return { status: 'skipped', reason: 'No valid email.' }

  const calendarUrl = `${publicAppBaseUrl()}/calendar`
  const loc = escapeHtml(locationLabel?.trim() || '—')
  const notes = description?.trim()
  const time = formatTimeForEmail(startTime)
  const firstName = assigneeName.split(' ')[0] || 'there'

  const subject = `Reminder for tomorrow: ${title.slice(0, 60)}`
  const html = buildEmailHtml({
    preheader: `Tomorrow at ${time} — ${title}`,
    accentColour: '#f59e0b',
    body: `
      <p style="margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px">
        This is your <strong>24-hour reminder</strong> for tomorrow's scheduled event.
        Please make sure everything is prepared before you head out.
      </p>
      ${eventDetailsTable({ title, date: `${formatDateForEmail(date)} (tomorrow)`, time, location: loc, rawLocation: locationLabel })}
      ${mapsButton(locationLabel, '#f59e0b')}
      ${notes ? `<p style="margin:16px 0 4px"><strong>Manager notes:</strong></p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px">${escapeHtml(notes)}</p>` : ''}
      <div style="margin:20px 0;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
        <p style="margin:0 0 10px;font-weight:600;color:#166534">✅ Pre-event checklist</p>
        <ul style="margin:0;padding-left:20px;color:#15803d;line-height:1.8">
          <li>Check and pack all required materials and tools</li>
          <li>Review the job location and plan your route</li>
          <li>Confirm any site access details or security codes</li>
          <li>Check the manager notes above for any special instructions</li>
          <li>Ensure your vehicle is ready and fuelled</li>
        </ul>
      </div>
      <p style="margin:24px 0 0">
        <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;background:#f59e0b;color:#fff;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none">View calendar</a>
      </p>
    `,
  })

  try {
    await sendMailViaGraph({ to: email, subject, bodyHtml: html })
    return { status: 'sent', recipients: 1 }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}

/**
 * 2-hour advance reminder: sent a couple of hours before the event starts.
 */
export async function notifyCalendarReminder2h(
  supabase: SupabaseClient,
  params: {
    assigneeUserId: string
    assigneeName: string
    title: string
    date: string
    startTime: string
    locationLabel: string | null
    description: string | null
  },
): Promise<PortalNotifyResult> {
  if (isCalendarNotificationsDisabled()) {
    return { status: 'skipped', reason: 'notifications disabled (local testing)' }
  }

  const { assigneeUserId, assigneeName, title, date, startTime, locationLabel, description } = params

  const { data: userData, error } = await supabase.auth.admin.getUserById(assigneeUserId)
  if (error) return { status: 'failed', error: error.message }
  const email = String(userData.user?.email ?? '').trim()
  if (!isValidEmail(email)) return { status: 'skipped', reason: 'No valid email.' }

  const calendarUrl = `${publicAppBaseUrl()}/calendar`
  const loc = escapeHtml(locationLabel?.trim() || '—')
  const notes = description?.trim()
  const time = formatTimeForEmail(startTime)
  const firstName = assigneeName.split(' ')[0] || 'there'

  const subject = `Starting soon today: ${title.slice(0, 60)} at ${time}`
  const html = buildEmailHtml({
    preheader: `Your event starts in about 2 hours — ${title} at ${loc}`,
    accentColour: '#ef4444',
    body: `
      <p style="margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px">
        Your scheduled event is <strong>starting in approximately 2 hours</strong>. Here are the details:
      </p>
      ${eventDetailsTable({ title, date: `${formatDateForEmail(date)} (today)`, time, location: loc, rawLocation: locationLabel })}
      ${mapsButton(locationLabel, '#ef4444')}
      ${notes ? `<p style="margin:16px 0 4px"><strong>Manager notes:</strong></p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#fff1f2;border-left:3px solid #ef4444;border-radius:4px">${escapeHtml(notes)}</p>` : ''}
      <p style="margin:16px 0;color:#6b7280;font-size:13px">
        If you have any issues getting to the site or need to update this booking, please contact your manager immediately.
      </p>
      <p style="margin:24px 0 0">
        <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;background:#ef4444;color:#fff;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none">View calendar</a>
      </p>
    `,
  })

  try {
    await sendMailViaGraph({ to: email, subject, bodyHtml: html })
    return { status: 'sent', recipients: 1 }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

function formatDateForEmail(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return yyyyMmDd
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTimeForEmail(hhmm: string): string {
  const [hh, mm] = hhmm.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return hhmm
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function eventDetailsTable(p: { title: string; date: string; time: string; location: string | null; rawLocation?: string | null }): string {
  const mapsUrl = p.rawLocation?.trim()
    ? `https://maps.google.com/?q=${encodeURIComponent(p.rawLocation.trim())}`
    : null
  const locationCell = mapsUrl
    ? `<a href="${mapsUrl}" style="color:#2563eb;text-decoration:underline">${p.location ?? ''}</a>`
    : (p.location ?? '')
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:8px 12px 8px 0;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top">${label}</td>
      <td style="padding:8px 0;color:#111827">${value}</td>
    </tr>`
  return `
    <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;margin:0 0 16px;overflow:hidden">
      <tbody style="padding:4px 16px;display:table;width:100%">
        ${row('Event', `<strong>${escapeHtml(p.title)}</strong>`)}
        ${row('Date', escapeHtml(p.date))}
        ${row('Time', escapeHtml(p.time))}
        ${row('Location', locationCell)}
      </tbody>
    </table>`
}

/** Prominent Google Maps navigation button — only rendered when a raw address is available. */
function mapsButton(rawLocation: string | null | undefined, accentColour: string): string {
  if (!rawLocation?.trim()) return ''
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(rawLocation.trim())}`
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
      <tr>
        <td>
          <a href="${mapsUrl}"
             style="display:inline-flex;align-items:center;gap:8px;background:${accentColour};color:#fff;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;text-decoration:none;letter-spacing:-0.1px">
            &#128205; Get directions on Google Maps
          </a>
          <p style="margin:8px 0 0;font-size:12px;color:#6b7280">
            Or copy the address: <span style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px">${escapeHtml(rawLocation.trim())}</span>
          </p>
        </td>
      </tr>
    </table>`
}

function buildEmailHtml(p: { preheader: string; accentColour: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NBE Portal</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(p.preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <!-- Header -->
      <tr>
        <td style="background:${p.accentColour};padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px">NBE Portal</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">Calendar notification</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:28px 28px 24px;color:#111827;font-size:15px;line-height:1.6">
          ${p.body}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
          You received this email because an event was assigned to you in the NBE Portal.
          This is an automated message — please do not reply.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
