import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export type MergedReportSecureRow = {
  id: string
  client_id: string
  client_name: string | null
  pdf_storage_path: string | null
  pdf_url: string | null
  access_expires_at: string | null
  status: string | null
  approved: boolean | null
}

/**
 * Service role lookup by public token (server-only). Do not use for authorization by itself — the caller must
 * enforce JWT + client gate (`checkMergedReportClientGate`) before exposing PDFs or incrementing views.
 * Accepts `share_token` text or legacy `access_token` UUID string (same value for new rows).
 */
export async function fetchMergedReportByAccessToken(
  token: string
): Promise<MergedReportSecureRow | null> {
  const t = String(token ?? '').trim()
  if (!t) return null

  const supabase = createServiceRoleClient()
  const base = () =>
    supabase
      .from('merged_reports')
      .select('id, client_id, client_name, pdf_storage_path, pdf_url, access_expires_at, status, approved')
      .is('deleted_at', null)

  const byShare = await base().eq('share_token', t).maybeSingle()
  if (byShare.data) return byShare.data as MergedReportSecureRow

  const byAccess = await base().eq('access_token', t).maybeSingle()
  if (byAccess.data) return byAccess.data as MergedReportSecureRow

  return null
}

export function checkMergedReportClientGate(
  row: MergedReportSecureRow,
  userClientId: string | null | undefined
): 'ok' | 'wrong_client' | 'expired' | 'no_client_profile' | 'not_approved' {
  if (!userClientId) return 'no_client_profile'
  if (row.client_id !== userClientId) return 'wrong_client'
  // Null-safe: treat null as approved so rows that pre-date the approval column
  // (or rows backfilled to approved=true) are never accidentally blocked.
  // Only an explicit approved=false (new merges awaiting approval) is blocked.
  if (row.approved === false) return 'not_approved'
  if (row.access_expires_at) {
    const exp = new Date(row.access_expires_at).getTime()
    if (!Number.isNaN(exp) && exp < Date.now()) return 'expired'
  }
  return 'ok'
}
