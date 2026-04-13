import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export type MergedReportSecureRow = {
  id: string
  client_id: string
  client_name: string | null
  pdf_storage_path: string | null
  pdf_url: string | null
  access_expires_at: string | null
}

/**
 * Service role lookup by public token (server-only).
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
      .select('id, client_id, client_name, pdf_storage_path, pdf_url, access_expires_at')
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
): 'ok' | 'wrong_client' | 'expired' | 'no_client_profile' {
  if (!userClientId) return 'no_client_profile'
  if (row.client_id !== userClientId) return 'wrong_client'
  if (row.access_expires_at) {
    const exp = new Date(row.access_expires_at).getTime()
    if (!Number.isNaN(exp) && exp < Date.now()) return 'expired'
  }
  return 'ok'
}
