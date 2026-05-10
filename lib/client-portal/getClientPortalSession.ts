import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { safeProfilePortalLocationId } from '@/lib/client-portal/safeProfilePortalLocationId'

/** Ensures portal location belongs to client org; returns null if unset or invalid. */
export async function resolveValidatedPortalLocationId(
  clientId: string,
  rawPortalLocationId: unknown,
): Promise<string | null> {
  const id = String(rawPortalLocationId ?? '').trim()
  if (!id) return null

  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('client_locations').select('id, client_id').eq('id', id).maybeSingle()

  const row = data as { id?: string; client_id?: string } | null
  if (!row?.id || String(row.client_id ?? '').trim() !== clientId.trim()) {
    return null
  }
  return String(row.id)
}

export type ClientPortalSessionOk = {
  ok: true
  userId: string
  clientId: string
  /** When non-null, dashboard/reports/gallery/PDFs are limited to this site. */
  portalLocationId: string | null
  portalLocationLabel: string | null
}

export type ClientPortalSessionFail = {
  ok: false
  reason: 'no_session' | 'not_client' | 'no_client_org' | 'inactive'
}

export type ClientPortalSession = ClientPortalSessionOk | ClientPortalSessionFail

export async function getClientPortalSession(): Promise<ClientPortalSession> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { ok: false, reason: 'no_session' }
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, client_id, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[getClientPortalSession] profiles select', profileErr)
    return { ok: false, reason: 'no_session' }
  }

  if (profile?.role !== 'client') {
    return { ok: false, reason: 'not_client' }
  }
  if (profile?.is_active === false) {
    return { ok: false, reason: 'inactive' }
  }

  const clientId = profile.client_id ? String(profile.client_id).trim() : ''
  if (!clientId) {
    return { ok: false, reason: 'no_client_org' }
  }

  const portalRaw = await safeProfilePortalLocationId(user.id)
  const portalLocationId = await resolveValidatedPortalLocationId(clientId, portalRaw)

  let portalLocationLabel: string | null = null
  if (portalLocationId) {
    const svc = createServiceRoleClient()
    const { data: loc } = await svc
      .from('client_locations')
      .select('location_name')
      .eq('id', portalLocationId)
      .maybeSingle()
    portalLocationLabel = String((loc as { location_name?: string | null } | null)?.location_name ?? '').trim() || null
  }

  return {
    ok: true,
    userId: user.id,
    clientId,
    portalLocationId,
    portalLocationLabel,
  }
}
