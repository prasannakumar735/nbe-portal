import type { SupabaseClient } from '@supabase/supabase-js'
import { isManagerOrAdminRole } from '@/lib/auth/roles'

/** Load profiles.role and test manager/admin (used in API routes with user-scoped Supabase client). */
export async function fetchIsManagerOrAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return isManagerOrAdminRole((data as { role?: string } | null)?.role)
}
