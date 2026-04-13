'use client'

import { UsersTable } from '@/components/users/UsersTable'
import type { ManagedUserRow } from '@/lib/types/user-management.types'

type UsersTabProps = {
  initialUsers: ManagedUserRow[]
  currentUserId: string
  usersError?: string
}

export function UsersTab({ initialUsers, currentUserId, usersError }: UsersTabProps) {
  return (
    <div className="space-y-3">
      {usersError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{usersError}</div>
      ) : null}
      <UsersTable initialUsers={initialUsers} currentUserId={currentUserId} showPageHeader={false} />
    </div>
  )
}
