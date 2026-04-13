import type { SupabaseClient } from '@supabase/supabase-js'

export function clientLocationLabel(loc: Record<string, unknown> | null | undefined): string {
  if (!loc) return ''
  const name = String(loc.location_name ?? loc.name ?? loc.site_name ?? loc.suburb ?? '').trim()
  const company = String(loc.Company_address ?? '').trim()
  const normalizedCompany = company.toLowerCase() === 'null' ? '' : company
  const fallback = String(loc.address ?? loc.site_address ?? loc.location_address ?? '').trim()
  return (normalizedCompany || fallback || name || '').trim()
}

export async function isManagerOrAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  const r = String(data?.role ?? '')
  return r === 'admin' || r === 'manager'
}
