import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { publicAppBaseUrl } from '@/lib/app/publicAppBaseUrl'
import { getManagerPlusServiceRecipients, isValidEmail } from '@/lib/notifications/managerRecipients'

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
  },
): Promise<PortalNotifyResult> {
  const { assigneeUserId, creatorDisplayName, title, date, startTime, isFullDay, locationLabel } =
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
  const timeLine = isFullDay ? 'All day' : escapeHtml(String(startTime ?? '—'))
  const loc = escapeHtml(locationLabel?.trim() || '—')

  const subject = `New calendar event: ${title.slice(0, 80)}`
  const html = [
    `Hi,<br/><br/>`,
    `<b>${escapeHtml(creatorDisplayName)}</b> scheduled an event for you:<br/><br/>`,
    `<b>${escapeHtml(title)}</b><br/>`,
    `Date: ${escapeHtml(date)}<br/>`,
    `Time: ${timeLine}<br/>`,
    `Location: ${loc}<br/><br/>`,
    `<a href="${escapeHtml(calendarUrl)}">View calendar</a><br/><br/>`,
    `— NBE Portal`,
  ].join('')

  try {
    await sendMailViaGraph({ to: email, subject, bodyHtml: html })
    return { status: 'sent', recipients: 1 }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Graph send failed.' }
  }
}
