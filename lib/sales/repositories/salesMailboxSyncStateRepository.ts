import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesMailboxSyncState,
  SalesMailboxSyncStateUpsert,
} from '@/lib/sales/types/replyManagement.types'

const TABLE = 'sales_mailbox_sync_state'

function mapRow(row: Record<string, unknown>): SalesMailboxSyncState {
  return {
    id: String(row.id),
    mailbox_user_id: String(row.mailbox_user_id),
    folder: String(row.folder),
    delta_link: row.delta_link != null ? String(row.delta_link) : null,
    last_received_at: row.last_received_at != null ? String(row.last_received_at) : null,
    last_sync_at: row.last_sync_at != null ? String(row.last_sync_at) : null,
    last_error: row.last_error != null ? String(row.last_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getSalesMailboxSyncState(
  supabase: SupabaseClient,
  mailboxUserId: string,
  folder = 'Inbox',
): Promise<SalesMailboxSyncState | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('mailbox_user_id', mailboxUserId)
    .eq('folder', folder)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function upsertSalesMailboxSyncState(
  supabase: SupabaseClient,
  row: SalesMailboxSyncStateUpsert,
): Promise<SalesMailboxSyncState> {
  const folder = row.folder ?? 'Inbox'
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        mailbox_user_id: row.mailbox_user_id,
        folder,
        delta_link: row.delta_link ?? null,
        last_received_at: row.last_received_at ?? null,
        last_sync_at: row.last_sync_at ?? now,
        last_error: row.last_error ?? null,
        updated_at: now,
      },
      { onConflict: 'mailbox_user_id,folder' },
    )
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
