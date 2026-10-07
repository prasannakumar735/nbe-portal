import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { getManagerPlusServiceRecipients } from '@/lib/notifications/managerRecipients'
import type { PortalNotifyResult } from '@/lib/notifications/portalGraphNotifications'
import { formatDdMmYyyy } from '@/lib/timecard/weeklyReminderSchedule'

export const PORTAL_TIMECARDS_URL = 'https://portal.nbeaustralia.com.au/dashboard/timecards'

function portalLinkHtml(): string {
  return `<a href="${escapeHtml(PORTAL_TIMECARDS_URL)}">Portal</a>`
}

function weekRangeLabel(weekStart: string, weekEnd: string): string {
  return `${formatDdMmYyyy(weekStart)} to ${formatDdMmYyyy(weekEnd)}`
}

export async function notifyTimesheetReminder1(params: {
  toEmail: string
  employeeName: string
  weekStart: string
  weekEnd: string
}): Promise<void> {
  const subject = `${params.employeeName} Weekly timecard pending submit`
  const html = [
    `Hi ${escapeHtml(params.employeeName)},<br/><br/>`,
    `Your timecard for week from ${escapeHtml(formatDdMmYyyy(params.weekStart))} to ${escapeHtml(formatDdMmYyyy(params.weekEnd))} is due for submission.<br/><br/>`,
    `Please login to ${portalLinkHtml()} and submit.<br/><br/>`,
    `— NBE Portal`,
  ].join('')
  await sendMailViaGraph({ to: params.toEmail, subject, bodyHtml: html })
}

export async function notifyTimesheetReminder2(params: {
  toEmail: string
  employeeName: string
  weekStart: string
  weekEnd: string
}): Promise<void> {
  const subject = `${params.employeeName} Weekly timecard pending submit`
  const html = [
    `Hi ${escapeHtml(params.employeeName)},<br/><br/>`,
    `Your timecard for week from ${escapeHtml(formatDdMmYyyy(params.weekStart))} to ${escapeHtml(formatDdMmYyyy(params.weekEnd))} is overdue by 1 day for submission.<br/><br/>`,
    `Please login to ${portalLinkHtml()} and submit.<br/><br/>`,
    `— NBE Portal`,
  ].join('')
  await sendMailViaGraph({ to: params.toEmail, subject, bodyHtml: html })
}

export async function notifyTimesheetAutoSubmittedEmployee(params: {
  toEmail: string
  employeeName: string
  weekStart: string
  weekEnd: string
}): Promise<void> {
  const subject = `${params.employeeName} Weekly timecard auto-submitted`
  const html = [
    `Hi ${escapeHtml(params.employeeName)},<br/><br/>`,
    `Your timecard for week from ${escapeHtml(formatDdMmYyyy(params.weekStart))} to ${escapeHtml(formatDdMmYyyy(params.weekEnd))} was auto-submitted by the system.<br/><br/>`,
    `Please reach out to your manager for corrections if needed. You can view it in the ${portalLinkHtml()}.<br/><br/>`,
    `— NBE Portal`,
  ].join('')
  await sendMailViaGraph({ to: params.toEmail, subject, bodyHtml: html })
}

export type AutoSubmittedEmployee = {
  employeeDisplayName: string
  weekStartDate: string
  weekEndDate: string
}

export async function notifyTimesheetAutoSubmittedManagersBatch(
  supabase: Parameters<typeof getManagerPlusServiceRecipients>[0],
  employees: AutoSubmittedEmployee[],
): Promise<PortalNotifyResult> {
  if (employees.length === 0) {
    return { status: 'skipped', reason: 'No auto-submitted employees.' }
  }

  let recipients: Awaited<ReturnType<typeof getManagerPlusServiceRecipients>>
  try {
    recipients = await getManagerPlusServiceRecipients(supabase)
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Recipient lookup failed.' }
  }

  if (recipients.length === 0) {
    return { status: 'skipped', reason: 'No manager/admin or service recipients.' }
  }

  const subject =
    employees.length === 1
      ? `Timesheet auto-submitted: ${employees[0]!.employeeDisplayName}`
      : `${employees.length} timesheets auto-submitted for review`

  const rows = employees
    .map(
      e =>
        `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0">${escapeHtml(e.employeeDisplayName)}</td>` +
        `<td style="padding:6px 12px;border:1px solid #e2e8f0">${escapeHtml(weekRangeLabel(e.weekStartDate, e.weekEndDate))}</td></tr>`,
    )
    .join('')
  const table =
    `<table style="border-collapse:collapse;margin:12px 0"><thead><tr>` +
    `<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left">Employee</th>` +
    `<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left">Week</th></tr></thead><tbody>${rows}</tbody></table>`

  try {
    for (const r of recipients) {
      const name = String(r.full_name ?? '').trim() || 'there'
      const html = [
        `Hi ${escapeHtml(name)},<br/><br/>`,
        employees.length === 1
          ? `The following timesheet was auto-submitted by the system because it was not submitted in time:<br/>`
          : `The following ${employees.length} timesheets were auto-submitted by the system because they were not submitted in time:<br/>`,
        table,
        `<br/><a href="${escapeHtml(PORTAL_TIMECARDS_URL)}">Open timecards</a><br/><br/>`,
        `— NBE Portal`,
      ].join('')
      await sendMailViaGraph({ to: r.email, subject, bodyHtml: html })
    }
    return { status: 'sent', recipients: recipients.length }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}

export type DigestPendingRow = {
  employeeName: string
  weekStart: string
  weekEnd: string
  totalHours: number
}

export async function notifyTimesheetManagerDigest(
  supabase: Parameters<typeof getManagerPlusServiceRecipients>[0],
  params: { weekStart: string; weekEnd: string; pending: DigestPendingRow[] },
): Promise<PortalNotifyResult> {
  if (!params.pending.length) {
    return { status: 'skipped', reason: 'No pending timesheets.' }
  }

  let recipients: Awaited<ReturnType<typeof getManagerPlusServiceRecipients>>
  try {
    recipients = await getManagerPlusServiceRecipients(supabase)
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Recipient lookup failed.' }
  }

  if (recipients.length === 0) {
    return { status: 'skipped', reason: 'No manager/admin or service recipients.' }
  }

  const range = weekRangeLabel(params.weekStart, params.weekEnd)
  const rows = params.pending
    .map(
      p =>
        `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0">${escapeHtml(p.employeeName)}</td>` +
        `<td style="padding:6px 12px;border:1px solid #e2e8f0">${escapeHtml(formatDdMmYyyy(p.weekStart))} – ${escapeHtml(formatDdMmYyyy(p.weekEnd))}</td>` +
        `<td style="padding:6px 12px;border:1px solid #e2e8f0">${escapeHtml(String(p.totalHours))}</td></tr>`,
    )
    .join('')

  const subject = `Weekly timecards pending submit — week ${formatDdMmYyyy(params.weekStart)}`
  const table =
    `<table style="border-collapse:collapse;margin:12px 0"><thead><tr>` +
    `<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left">Employee</th>` +
    `<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left">Week</th>` +
    `<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left">Hours</th></tr></thead><tbody>${rows}</tbody></table>`

  try {
    for (const r of recipients) {
      const name = String(r.full_name ?? '').trim() || 'there'
      const html = [
        `Hi ${escapeHtml(name)},<br/><br/>`,
        `The following team timecards for ${escapeHtml(range)} are still draft or rejected and need submission:<br/>`,
        table,
        `<br/><a href="${escapeHtml(PORTAL_TIMECARDS_URL)}">Open timecards</a><br/><br/>`,
        `— NBE Portal`,
      ].join('')
      await sendMailViaGraph({ to: r.email, subject, bodyHtml: html })
    }
    return { status: 'sent', recipients: recipients.length }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}
