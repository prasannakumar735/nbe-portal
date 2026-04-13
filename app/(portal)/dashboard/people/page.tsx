import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getUsers } from '@/lib/users/actions'
import { getServerUser } from '@/lib/auth/server'
import { getClientUsersForManagement } from '@/lib/clients/queries'
import { PeopleTabs, type PeopleTabId } from '@/components/people/PeopleTabs'

function tabFromSearch(raw: string | undefined, canManageClients: boolean): PeopleTabId {
  if (raw === 'contacts') return 'contacts'
  if (raw === 'clients' && canManageClients) return 'clients'
  return 'users'
}

function PeopleTabsFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-36 rounded-lg bg-slate-200" />
      <div className="h-4 w-72 rounded bg-slate-100" />
      <div className="h-11 max-w-md rounded-lg bg-slate-200" />
      <div className="mt-6 h-40 rounded-2xl bg-slate-100" />
    </div>
  )
}

export default async function DashboardPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role
  if (role !== 'admin' && role !== 'manager') {
    redirect('/dashboard')
  }

  const canManageClients = role === 'admin' || role === 'manager'

  const { tab } = await searchParams
  const initialTab = tabFromSearch(tab, canManageClients)

  const sessionUser = await getServerUser()
  const [{ users, error: usersError }, { clients: initialClients, error: clientsError }] = await Promise.all([
    getUsers(),
    getClientUsersForManagement(),
  ])

  return (
    <div>
      <Suspense fallback={<PeopleTabsFallback />}>
        <PeopleTabs
          initialTab={initialTab}
          initialUsers={users}
          usersError={usersError}
          currentUserId={sessionUser?.id ?? ''}
          initialClients={initialClients}
          clientsError={clientsError}
          canManageClients={canManageClients}
        />
      </Suspense>
    </div>
  )
}
