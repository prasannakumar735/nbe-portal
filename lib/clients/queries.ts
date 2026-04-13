import { requireManagerOrAdmin } from '@/lib/users/staff'
import { listClientUsers } from '@/lib/clients/service'
import type { ClientUserRow } from '@/lib/types/client-users.types'

export async function getClientUsersForManagement(): Promise<{ clients: ClientUserRow[]; error?: string }> {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return { clients: [], error: gate.error }
  }
  return listClientUsers()
}
