'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBrowserPathname } from '@/lib/app/useBrowserPathname'
import { useBrowserSearchParams } from '@/lib/app/useBrowserSearchParams'
import type { ManagedUserRow } from '@/lib/types/user-management.types'
import type { ClientUserRow } from '@/lib/types/client-users.types'
import { UsersTab } from '@/components/people/UsersTab'
import { ContactsTab } from '@/components/people/ContactsTab'
import { ClientsTab } from '@/components/people/ClientsTab'

export type PeopleTabId = 'users' | 'contacts' | 'clients'

function tabFromSearchParam(raw: string | null, canManageClients: boolean): PeopleTabId {
  if (raw === 'contacts') return 'contacts'
  if (raw === 'clients' && canManageClients) return 'clients'
  return 'users'
}

type PeopleTabsProps = {
  initialTab: PeopleTabId
  initialUsers: ManagedUserRow[]
  usersError?: string
  currentUserId: string
  initialClients: ClientUserRow[]
  clientsError?: string
  /** When false, Clients tab is hidden and ?tab=clients falls back to users. */
  canManageClients: boolean
}

export function PeopleTabs({
  initialTab,
  initialUsers,
  usersError,
  currentUserId,
  initialClients,
  clientsError,
  canManageClients,
}: PeopleTabsProps) {
  const router = useRouter()
  const pathname = useBrowserPathname()
  const searchParams = useBrowserSearchParams()
  const [tab, setTab] = useState<PeopleTabId>(initialTab)

  useEffect(() => {
    setTab(tabFromSearchParam(searchParams.get('tab'), canManageClients))
  }, [searchParams, canManageClients])

  const selectTab = useCallback(
    (next: PeopleTabId) => {
      if (next === 'clients' && !canManageClients) {
        return
      }
      setTab(next)
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams, canManageClients]
  )

  return (
    <div>
      <header className="border-b border-slate-200 pb-2">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">People</h1>
        <p className="mt-0.5 text-xs text-slate-500">Portal accounts, contact QR cards, and client report logins.</p>
        <div
          className="mt-3 inline-flex w-full max-w-xl gap-0.5 rounded-lg bg-slate-100 p-0.5 sm:w-auto"
          role="tablist"
          aria-label="People sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            id="people-tab-users"
            aria-controls="people-panel-users"
            onClick={() => selectTab('users')}
            className={`min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              tab === 'users'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'contacts'}
            id="people-tab-contacts"
            aria-controls="people-panel-contacts"
            onClick={() => selectTab('contacts')}
            className={`min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              tab === 'contacts'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Contacts
          </button>
          {canManageClients ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'clients'}
              id="people-tab-clients"
              aria-controls="people-panel-clients"
              onClick={() => selectTab('clients')}
              className={`min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                tab === 'clients'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clients
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-4">
        <section
          id="people-panel-users"
          role="tabpanel"
          aria-labelledby="people-tab-users"
          hidden={tab !== 'users'}
        >
          <UsersTab initialUsers={initialUsers} usersError={usersError} currentUserId={currentUserId} />
        </section>
        <section
          id="people-panel-contacts"
          role="tabpanel"
          aria-labelledby="people-tab-contacts"
          hidden={tab !== 'contacts'}
        >
          <ContactsTab />
        </section>
        {canManageClients ? (
          <section
            id="people-panel-clients"
            role="tabpanel"
            aria-labelledby="people-tab-clients"
            hidden={tab !== 'clients'}
          >
            <ClientsTab initialClients={initialClients} clientsError={clientsError} />
          </section>
        ) : null}
      </div>
    </div>
  )
}
