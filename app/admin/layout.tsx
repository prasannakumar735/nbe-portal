import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { createServerClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerUser()
  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isAdmin(profile as { role?: string } | null)) {
    redirect('/')
  }

  return <>{children}</>
}
