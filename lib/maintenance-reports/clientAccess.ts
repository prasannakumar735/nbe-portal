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
  location_name: string | null
  /** Site row on the maintenance report (for location-scoped portal users). */
  client_location_id: string | null
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

  // Use PostgREST join to fetch location + client in one query
  const { data: report, error } = await supabase
    .from('maintenance_reports')
    .select(`
      id, status, approved, share_token, pdf_url, client_location_id,
      client_locations (
        client_id,
        location_name, name, site_name, suburb,
        clients ( client_name, name, company_name )
      )
    `)
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
    client_locations?: {
      client_id?: string | null
      location_name?: string | null
      name?: string | null
      site_name?: string | null
      suburb?: string | null
      clients?: { client_name?: string | null; name?: string | null; company_name?: string | null } | null
    } | null
  }

  const loc = r.client_locations
  const locationName = loc
    ? String(loc.location_name ?? loc.name ?? loc.site_name ?? loc.suburb ?? '').trim() || null
    : null

  const clientId = loc?.client_id ? String(loc.client_id).trim() || null : null

  const c = loc?.clients
  const clientName = c
    ? String(c.client_name ?? c.name ?? c.company_name ?? '').trim() || null
    : null

  return {
    id: r.id,
    status: r.status,
    approved: Boolean(r.approved),
    share_token: r.share_token,
    pdf_url: r.pdf_url,
    client_id: clientId,
    client_name: clientName,
    location_name: locationName,
    client_location_id: r.client_location_id,
  }
}

export function checkMaintenanceReportClientGate(
  row: MaintenanceReportClientAccessRow,
  userClientId: string | null | undefined,
  portalLocationId?: string | null,
): 'ok' | 'wrong_client' | 'not_approved' | 'no_client_profile' | 'no_pdf' {
  if (!row.pdf_url?.trim()) return 'no_pdf'
  if (row.status !== 'approved' || !row.approved) return 'not_approved'
  if (!userClientId) return 'no_client_profile'
  if (!row.client_id || row.client_id !== userClientId) return 'wrong_client'
  const scope = String(portalLocationId ?? '').trim()
  if (scope) {
    const rowLoc = String(row.client_location_id ?? '').trim()
    if (!rowLoc || rowLoc !== scope) return 'wrong_client'
  }
  return 'ok'
}
