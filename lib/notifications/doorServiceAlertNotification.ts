import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'
import { isCalendarNotificationsDisabled } from '@/lib/notifications/isCalendarNotificationsDisabled'
import { isValidEmail } from '@/lib/notifications/managerRecipients'

export type PortalNotifyResult =
  | { status: 'sent'; recipients: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

type AlertDoor = {
  id: string
  door_label: string
  door_type: string | null
  due_date: string
  last_inspection_date: string | null
  install_date: string | null
}

function formatDate(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return yyyyMmDd
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDoorRows(doors: AlertDoor[]): string {
  const row = (d: AlertDoor) => {
    const lastService = d.last_inspection_date
      ? formatDate(d.last_inspection_date)
      : d.install_date
        ? `Not yet serviced (installed ${formatDate(d.install_date)})`
        : 'Not yet serviced'
    return `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 12px;font-weight:600;color:#111827">${escapeHtml(d.door_label)}</td>
        <td style="padding:10px 12px;color:#374151">${escapeHtml(d.door_type ?? '—')}</td>
        <td style="padding:10px 12px;color:#374151">${escapeHtml(lastService)}</td>
        <td style="padding:10px 12px;font-weight:600;color:#dc2626">${escapeHtml(formatDate(d.due_date))}</td>
      </tr>`
  }
  return `
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;margin:0 0 20px;font-size:13px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em">Door</th>
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em">Type</th>
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em">Last Serviced</th>
          <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em">Service Due</th>
        </tr>
      </thead>
      <tbody>
        ${doors.map(row).join('')}
      </tbody>
    </table>`
}

function buildHtml(p: {
  recipientName: string
  clientName: string
  locationName: string
  doors: AlertDoor[]
  leadTimeDays: number
  serviceIntervalMonths: number
  settingsUrl: string
}): string {
  const doorWord = p.doors.length === 1 ? 'door' : 'doors'
  const preheader = `${p.doors.length} ${doorWord} at ${p.clientName} (${p.locationName}) require service attention`
  const serviceRemindersUrl = `${p.settingsUrl}/service-reminders`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NBE Portal — Door Service Alert</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <tr>
        <td style="background:#0f172a;padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px">NBE Portal</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px">Door Service Alert — Action Required</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;color:#111827;font-size:15px;line-height:1.6">
          <p style="margin:0 0 16px">Hi ${escapeHtml(p.recipientName)},</p>
          <p style="margin:0 0 16px">
            The following ${escapeHtml(String(p.doors.length))} ${doorWord} at
            <strong>${escapeHtml(p.clientName)}</strong> — <strong>${escapeHtml(p.locationName)}</strong>
            ${p.doors.length === 1 ? 'is' : 'are'} approaching or past their
            ${escapeHtml(String(p.serviceIntervalMonths))}-month service interval.
            Notification sent <strong>${escapeHtml(String(p.leadTimeDays))} days</strong> before each due date.
          </p>
          ${buildDoorRows(p.doors)}
          <p style="margin:0 0 16px;font-size:14px;color:#374151">
            Please review and schedule service visits as needed.
            This email covers all doors at this location that are currently due — you will not receive
            duplicates for these doors unless they are serviced and become due again.
          </p>
          <p style="margin:0 0 24px">
            <a href="${escapeHtml(serviceRemindersUrl)}"
               style="display:inline-block;background:#0f172a;color:#fff;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
              View Service Reminders
            </a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.5">
          You received this automated alert from the NBE Portal because one or more client doors are approaching
          their scheduled service date. Notification timing is configurable in Portal Settings.
          To adjust the lead time (currently ${escapeHtml(String(p.leadTimeDays))} days), contact your portal administrator.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/**
 * Send a door-service-due digest email to all nbeaustralia.com.au managers.
 * One email per client+location group listing ALL doors due in that batch.
 */
export async function notifyDoorServiceAlertManagers(
  supabase: SupabaseClient,
  params: {
    clientName: string
    locationName: string
    doors: AlertDoor[]
    leadTimeDays: number
    serviceIntervalMonths: number
    customRecipients?: Array<{ email: string; name: string }>
  },
): Promise<PortalNotifyResult> {
  if (isCalendarNotificationsDisabled()) {
    return { status: 'skipped', reason: 'notifications disabled (local testing)' }
  }

  let recipients: Array<{ email: string; name: string }>

  if (params.customRecipients && params.customRecipients.length > 0) {
    // Use admin-configured recipients (already validated as @nbeaustralia.com.au)
    recipients = params.customRecipients
  } else {
    // Fall back to all @nbeaustralia.com.au manager/admin profiles
    const { data: managers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['manager', 'admin'])

    const profileRows = (managers ?? []) as Array<{ id: string; full_name: string | null }>
    recipients = []

    await Promise.all(
      profileRows.map(async m => {
        const { data } = await supabase.auth.admin.getUserById(String(m.id))
        const email = String(data?.user?.email ?? '').trim().toLowerCase()
        if (!isValidEmail(email)) return
        if (!email.endsWith('@nbeaustralia.com.au')) return
        recipients.push({ email, name: String(m.full_name ?? '').trim() || 'there' })
      }),
    )
  }

  if (recipients.length === 0) {
    return { status: 'skipped', reason: 'No nbeaustralia.com.au manager recipients found.' }
  }

  const doorWord = params.doors.length === 1 ? 'door' : 'doors'
  const subject = `Door service alert: ${params.clientName} — ${params.locationName} (${params.doors.length} ${doorWord} due)`
  const baseUrl = publicAppBaseUrl()

  try {
    for (const r of recipients) {
      const html = buildHtml({
        recipientName: r.name,
        clientName: params.clientName,
        locationName: params.locationName,
        doors: params.doors,
        leadTimeDays: params.leadTimeDays,
        serviceIntervalMonths: params.serviceIntervalMonths,
        settingsUrl: baseUrl,
      })
      await sendMailViaGraph({ to: r.email, subject, bodyHtml: html })
    }
    return { status: 'sent', recipients: recipients.length }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}
