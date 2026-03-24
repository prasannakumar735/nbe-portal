import { createServerClient } from '@/lib/supabase/server'

export async function getUserRole(userId: string): Promise<string | null> {
  if (!userId) return null

  try {
    const supabase = await createServerClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    const roleFromProfile = String(profile?.role ?? '').trim()
    if (roleFromProfile) return roleFromProfile

    const { data: authData } = await supabase.auth.getUser()
    const roleFromMetadata = String(authData?.user?.user_metadata?.role ?? '').trim()
    if (authData?.user?.id === userId && roleFromMetadata) {
      return roleFromMetadata
    }

    return null
  } catch (error) {
    console.error('[getUserRole] Failed to resolve role:', error)
    return null
  }
}

export function canAccessInventoryByRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}
