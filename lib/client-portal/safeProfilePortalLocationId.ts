import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

/**
 * Reads optional single-site portal scope. If migration `066_profiles_client_portal_location`
 * is not applied yet, PostgREST errors — we return null instead of breaking every `/client` load.
 */
export async function safeProfilePortalLocationId(userId: string): Promise<string | null> {
  const id = String(userId ?? '').trim()
  if (!id) return null

  const svc = createServiceRoleClient()
  const { data, error } = await svc.from('profiles').select('client_portal_location_id').eq('id', id).maybeSingle()

  if (error) {
    const blob = `${error.message ?? ''} ${(error as { details?: string }).details ?? ''} ${error.code ?? ''}`.toLowerCase()
    if (
      blob.includes('client_portal_location_id') ||
      blob.includes('does not exist') ||
      blob.includes('schema cache') ||
      String(error.code ?? '') === '42703'
    ) {
      return null
    }
    console.warn('[client-portal] client_portal_location_id select failed', error)
    return null
  }

  const raw = (data as { client_portal_location_id?: string | null } | null)?.client_portal_location_id
  const s = String(raw ?? '').trim()
  return s || null
}
