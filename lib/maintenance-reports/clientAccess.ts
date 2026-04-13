import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

/** Row needed for /report/view and client PDF gate (service role, server-only). */
export type MaintenanceReportClientAccessRow = {
  id: string
  status: string
  approved: boolean
  share_token: string | null
  pdf_url: string | null
  client_id: string | null
  client_name: string | null
}

/**
 * Lookup a single maintenance report by public share_token.
 * Returns null if missing or token empty.
 */
export async function fetchMaintenanceReportByShareToken(
  token: string,
): Promise<MaintenanceReportClientAccessRow | null> {
  const t = String(token ?? '').trim()
  if (!t) return null

  const supabase = createServiceRoleClient()
  const { data: report, error } = await supabase
    .from('maintenance_reports')
    .select('id, status, approved, share_token, pdf_url, client_location_id')
    .eq('share_token', t)
    .maybeSingle()

  if (error || !report) return null

  const r = report as {
    id: string
    status: string
    approved: boolean | null
    share_token: string | null
    pdf_url: string | null
    client_location_id: string | null
  }

  let clientId: string | null = null
  let clientName: string | null = null

  const locId = r.client_location_id ? String(r.client_location_id).trim() : ''
  if (locId) {
    const { data: loc } = await supabase
      .from('client_locations')
      .select('client_id')
      .eq('id', locId)
      .maybeSingle()

    const cid = String((loc as { client_id?: string } | null)?.client_id ?? '').trim()
    if (cid) {
      clientId = cid
      const { data: clientRow } = await supabase
        .from('clients')
        .select('name, client_name, company_name')
        .eq('id', cid)
        .maybeSingle()

      const c = clientRow as { name?: string | null; client_name?: string | null; company_name?: string | null } | null
      clientName =
        String(c?.company_name ?? c?.client_name ?? c?.name ?? '').trim() || null
    }
  }

  return {
    id: r.id,
    status: r.status,
    approved: Boolean(r.approved),
    share_token: r.share_token,
    pdf_url: r.pdf_url,
    client_id: clientId,
    client_name: clientName,
  }
}

export function checkMaintenanceReportClientGate(
  row: MaintenanceReportClientAccessRow,
  userClientId: string | null | undefined,
): 'ok' | 'wrong_client' | 'not_approved' | 'no_client_profile' | 'no_pdf' {
  if (!row.pdf_url?.trim()) return 'no_pdf'
  if (row.status !== 'approved' || !row.approved) return 'not_approved'
  if (!userClientId) return 'no_client_profile'
  if (!row.client_id || row.client_id !== userClientId) return 'wrong_client'
  return 'ok'
}
