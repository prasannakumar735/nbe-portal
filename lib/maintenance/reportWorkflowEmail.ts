import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { publicAppBaseUrl, maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { getManagerPlusServiceRecipients, isValidEmail } from '@/lib/notifications/managerRecipients'
import { resolveClientLocationForReport } from '@/lib/maintenance/resolveClientLocationForReport'

function managerSubmissionHtml(params: {
  managerName: string
  technicianName: string
  clientName: string
  location: string
  technicianNotes: string
  reportUrl: string
}): string {
  const {
    managerName,
    technicianName,
    clientName,
    location,
    technicianNotes,
    reportUrl,
  } = params

  return [
    `Hi Manager ${escapeHtml(managerName)},<br/><br/>`,
    `<b>${escapeHtml(technicianName)}</b> submitted a maintenance report for:<br/>`,
    `Client: <b>${escapeHtml(clientName)}</b><br/>`,
    `Location: <b>${escapeHtml(location)}</b><br/><br/>`,
    `<b>Technician Notes:</b><br/>`,
    `${escapeHtml(technicianNotes)}<br/><br/>`,
    `Please review and approve the report.<br/><br/>`,
    `<a href="${escapeHtml(reportUrl)}">View Report</a><br/><br/>`,
    `Thanks,<br/>`,
    `NBE Team`,
  ].join('')
}

function technicianApprovalHtml(params: {
  technicianName: string
  clientName: string
  location: string
  reportUrl: string | null
}): string {
  const { technicianName, clientName, location, reportUrl } = params
  const linkBlock = reportUrl
    ? `<a href="${escapeHtml(reportUrl)}">View Report</a><br/><br/>`
    : ''

  return [
    `Hi ${escapeHtml(technicianName)},<br/><br/>`,
    `Your maintenance report for:<br/>`,
    `Client: <b>${escapeHtml(clientName)}</b><br/>`,
    `Location: <b>${escapeHtml(location)}</b><br/><br/>`,
    `has been <b>approved</b> by the manager.<br/><br/>`,
    `You can now proceed with further actions if required.<br/><br/>`,
    linkBlock,
    `Thanks,<br/>`,
    `NBE Team`,
  ].join('')
}

export type WorkflowEmailResult =
  | { status: 'sent'; recipients: number; detail?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

/**
 * Notify managers/admins when a report is submitted (Graph). Idempotent via
 * `manager_workflow_email_sent_at`.
 */
export async function notifyManagersOfReportSubmission(
  supabase: SupabaseClient,
  reportId: string,
): Promise<WorkflowEmailResult> {
  const { data: report, error: reportError } = await supabase
    .from('maintenance_reports')
    .select(
      'id, status, technician_name, notes, client_location_id, manager_workflow_email_sent_at',
    )
    .eq('id', reportId)
    .maybeSingle()

  if (reportError || !report) {
    const msg = reportError?.message ?? 'Report not found.'
    console.error('[notifyManagersOfReportSubmission] Load report failed', { reportId, msg })
    return { status: 'failed', error: msg }
  }

  const row = report as Record<string, unknown>
  const status = String(row.status ?? '').trim()
  if (status !== 'submitted') {
    const reason = `Report status is "${status}", not submitted.`
    console.warn('[notifyManagersOfReportSubmission] Skipped:', reason)
    return { status: 'skipped', reason }
  }

  if (row.manager_workflow_email_sent_at) {
    const reason = 'Manager notification already sent.'
    console.warn('[notifyManagersOfReportSubmission] Skipped:', reason)
    return { status: 'skipped', reason }
  }

  const technicianName = String(row.technician_name ?? 'Unknown').trim() || 'Unknown'
  const technicianNotesRaw = String(row.notes ?? '').trim()
  const technicianNotes = technicianNotesRaw || '(None)'

  const { clientName, locationName } = await resolveClientLocationForReport(
    supabase,
    row.client_location_id as string | null | undefined,
  )

  const reportUrl = `${publicAppBaseUrl()}/maintenance/${encodeURIComponent(reportId)}`

  let recipients: Array<{ email: string; full_name: string | null }>
  try {
    recipients = await getManagerPlusServiceRecipients(supabase)
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Recipient lookup failed.' }
  }

  if (recipients.length === 0) {
    const reason = 'No recipients (no manager/admin emails and service inbox could not be added).'
    console.warn('[notifyManagersOfReportSubmission] Skipped:', reason)
    return {
      status: 'skipped',
      reason,
    }
  }

  try {
    for (const manager of recipients) {
      const managerLabel = String(manager.full_name ?? '').trim() || 'there'
      const html = managerSubmissionHtml({
        managerName: managerLabel,
        technicianName,
        clientName,
        location: locationName,
        technicianNotes,
        reportUrl,
      })

      await sendMailViaGraph({
        to: manager.email,
        subject: 'New Maintenance Report Submitted',
        bodyHtml: html,
      })
    }

    const { error: updErr } = await supabase
      .from('maintenance_reports')
      .update({ manager_workflow_email_sent_at: new Date().toISOString() })
      .eq('id', reportId)
      .eq('status', 'submitted')

    if (updErr) {
      console.error('[notifyManagersOfReportSubmission] Failed to persist sent timestamp', updErr)
    }

    console.log('[notifyManagersOfReportSubmission] Sent', {
      reportId,
      recipients: recipients.length,
    })
    return { status: 'sent', recipients: recipients.length }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Graph send failed.'
    console.error('[notifyManagersOfReportSubmission] Graph send failed', { reportId, message })
    return { status: 'failed', error: message }
  }
}

/**
 * Notify the technician when a report is approved. Idempotent via
 * `technician_approval_email_sent_at`.
 */
export async function notifyTechnicianOfReportApproval(
  supabase: SupabaseClient,
  reportId: string,
  shareToken: string,
): Promise<WorkflowEmailResult> {
  const { data: report, error: reportError } = await supabase
    .from('maintenance_reports')
    .select(
      'id, status, technician_name, technician_email, submitter_email, client_location_id, technician_approval_email_sent_at',
    )
    .eq('id', reportId)
    .maybeSingle()

  if (reportError || !report) {
    const msg = reportError?.message ?? 'Report not found.'
    console.error('[notifyTechnicianOfReportApproval] Load report failed', { reportId, msg })
    return { status: 'failed', error: msg }
  }

  const row = report as Record<string, unknown>
  if (row.technician_approval_email_sent_at) {
    const reason = 'Technician approval notification already sent.'
    console.warn('[notifyTechnicianOfReportApproval] Skipped:', reason)
    return { status: 'skipped', reason }
  }

  const technicianEmail = String(row.technician_email ?? row.submitter_email ?? '')
    .trim()

  if (!isValidEmail(technicianEmail)) {
    const reason = 'No valid technician email on the report.'
    console.warn('[notifyTechnicianOfReportApproval] Skipped:', reason, { reportId })
    return { status: 'skipped', reason }
  }

  const technicianName = String(row.technician_name ?? 'Technician').trim() || 'Technician'

  const { clientName, locationName } = await resolveClientLocationForReport(
    supabase,
    row.client_location_id as string | null | undefined,
  )

  const viewUrl = maintenanceReportClientViewUrl(shareToken)

  const html = technicianApprovalHtml({
    technicianName,
    clientName,
    location: locationName,
    reportUrl: viewUrl,
  })

  try {
    await sendMailViaGraph({
      to: technicianEmail,
      subject: 'Maintenance Report Approved',
      bodyHtml: html,
    })

    const { error: updErr } = await supabase
      .from('maintenance_reports')
      .update({ technician_approval_email_sent_at: new Date().toISOString() })
      .eq('id', reportId)
      .eq('status', 'approved')

    if (updErr) {
      console.error('[notifyTechnicianOfReportApproval] Failed to persist sent timestamp', updErr)
    }

    console.log('[notifyTechnicianOfReportApproval] Sent', { reportId, to: technicianEmail })
    return { status: 'sent', recipients: 1 }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Graph send failed.'
    console.error('[notifyTechnicianOfReportApproval] Graph send failed', { reportId, message })
    return { status: 'failed', error: message }
  }
}
