import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'
import { publicAppBaseUrl, maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isValidEmail(value: string): boolean {
  const v = value.trim()
  return v.includes('@') && v.length > 3 && !v.includes(' ')
}

async function loadClientAndLocation(
  supabase: SupabaseClient,
  clientLocationId: string | null | undefined,
): Promise<{ clientName: string; locationName: string }> {
  let clientName = ''
  let locationName = ''

  if (!clientLocationId) {
    return { clientName: 'Unknown Client', locationName: 'Unknown Location' }
  }

  const { data: locationData } = await supabase
    .from('client_locations')
    .select('client_id, location_name, name, suburb, site_name')
    .eq('id', clientLocationId)
    .maybeSingle()

  if (locationData) {
    const loc = locationData as Record<string, unknown>
    locationName = String(
      loc.location_name ?? loc.name ?? loc.suburb ?? loc.site_name ?? '',
    ).trim()

    if (loc.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('client_name, name, company_name')
        .eq('id', loc.client_id)
        .maybeSingle()

      if (clientData) {
        const c = clientData as Record<string, unknown>
        clientName = String(c.client_name ?? c.name ?? c.company_name ?? '').trim()
      }
    }
  }

  return {
    clientName: clientName || 'Unknown Client',
    locationName: locationName || 'Unknown Location',
  }
}

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
    `Technician <b>${escapeHtml(technicianName)}</b> submitted a maintenance report for:<br/>`,
    `Client: <b>${escapeHtml(clientName)}</b><br/>`,
    `Location: <b>${escapeHtml(location)}</b><br/><br/>`,
    `<b>Technician Notes:</b><br/>`,
    `${escapeHtml(technicianNotes)}<br/><br/>`,
    `Please review and approve the report.<br/><br/>`,
    `<a href="${escapeHtml(reportUrl)}">View Report</a><br/><br/>`,
    `Thanks,<br/>`,
    `Technician ${escapeHtml(technicianName)}`,
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
    return { status: 'failed', error: reportError?.message ?? 'Report not found.' }
  }

  const row = report as Record<string, unknown>
  const status = String(row.status ?? '').trim()
  if (status !== 'submitted') {
    return { status: 'skipped', reason: `Report status is "${status}", not submitted.` }
  }

  if (row.manager_workflow_email_sent_at) {
    return { status: 'skipped', reason: 'Manager notification already sent.' }
  }

  const technicianName = String(row.technician_name ?? 'Unknown').trim() || 'Unknown'
  const technicianNotesRaw = String(row.notes ?? '').trim()
  const technicianNotes = technicianNotesRaw || '(None)'

  const { clientName, locationName } = await loadClientAndLocation(
    supabase,
    row.client_location_id as string | null | undefined,
  )

  const reportUrl = `${publicAppBaseUrl()}/maintenance/${encodeURIComponent(reportId)}`

  const { data: managers, error: mgrErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['manager', 'admin'])

  if (mgrErr) {
    return { status: 'failed', error: mgrErr.message }
  }

  const profileRows = managers ?? []
  const emailByUserId = new Map<string, string>()
  await Promise.all(
    profileRows.map(async (row) => {
      const id = String((row as { id?: string }).id ?? '').trim()
      if (!id) return
      const { data, error } = await supabase.auth.admin.getUserById(id)
      if (error || !data.user?.email) return
      const em = String(data.user.email).trim()
      if (isValidEmail(em)) emailByUserId.set(id, em)
    }),
  )

  const seen = new Set<string>()
  const recipients: Array<{ email: string; full_name: string | null }> = []
  for (const m of profileRows) {
    const id = String((m as { id?: string }).id ?? '').trim()
    const email = emailByUserId.get(id)
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push({
      email,
      full_name: String((m as { full_name?: string | null }).full_name ?? '').trim() || null,
    })
  }

  if (recipients.length === 0) {
    return {
      status: 'skipped',
      reason: 'No manager or admin profiles with a valid email address.',
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

    return { status: 'sent', recipients: recipients.length }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Graph send failed.'
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
    return { status: 'failed', error: reportError?.message ?? 'Report not found.' }
  }

  const row = report as Record<string, unknown>
  if (row.technician_approval_email_sent_at) {
    return { status: 'skipped', reason: 'Technician approval notification already sent.' }
  }

  const technicianEmail = String(row.technician_email ?? row.submitter_email ?? '')
    .trim()

  if (!isValidEmail(technicianEmail)) {
    return { status: 'skipped', reason: 'No valid technician email on the report.' }
  }

  const technicianName = String(row.technician_name ?? 'Technician').trim() || 'Technician'

  const { clientName, locationName } = await loadClientAndLocation(
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

    return { status: 'sent', recipients: 1 }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Graph send failed.'
    return { status: 'failed', error: message }
  }
}
