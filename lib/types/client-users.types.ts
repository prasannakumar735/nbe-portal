export type ClientUserStatus = 'active' | 'disabled'

export type ClientUserRow = {
  id: string
  name: string
  company_name: string
  email: string
  status: ClientUserStatus
  created_at: string
  /** public.clients.id — must match profiles.client_id for report access */
  client_id: string | null
  /** Resolved from clients table for display */
  linked_client_name?: string | null
}
