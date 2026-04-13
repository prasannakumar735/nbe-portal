import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'

export async function requireManagerReportsApi(
  supabase: SupabaseClient
): Promise<{ userId: string } | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ok = await fetchIsManagerOrAdmin(supabase, user.id)
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { userId: user.id }
}
