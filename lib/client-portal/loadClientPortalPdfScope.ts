import { createServerClient } from '@/lib/supabase/server'
import { resolveValidatedPortalLocationId } from '@/lib/client-portal/getClientPortalSession'
import { safeProfilePortalLocationId } from '@/lib/client-portal/safeProfilePortalLocationId'

/** Role + org + optional single-site scope for client PDF APIs. */
export async function loadClientPortalPdfScope(userId: string): Promise<
  { ok: true; clientId: string; portalLocationId: string | null } | { ok: false }
> {
  const serverSupabase = await createServerClient()
  const { data: profile, error: profileErr } = await serverSupabase
    .from('profiles')
    .select('role, client_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileErr || profile?.role !== 'client') {
    return { ok: false }
  }

  const clientId = profile.client_id ? String(profile.client_id).trim() : ''
  if (!clientId) {
    return { ok: false }
  }

  const portalRaw = await safeProfilePortalLocationId(userId)
  const portalLocationId = await resolveValidatedPortalLocationId(clientId, portalRaw)
  return { ok: true, clientId, portalLocationId }
}
