import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesManagerNotificationPriority,
  SalesManagerNotificationType,
} from '@/lib/sales/constants/managerNotifications'
import type {
  SalesManagerNotification,
  SalesManagerNotificationInsert,
} from '@/lib/sales/types/replyManagement.types'

const TABLE = 'sales_manager_notifications'

function mapRow(row: Record<string, unknown>): SalesManagerNotification {
  return {
    id: String(row.id),
    notification_type: row.notification_type as SalesManagerNotificationType,
    priority: row.priority as SalesManagerNotificationPriority,
    thread_id: row.thread_id != null ? String(row.thread_id) : null,
    message_id: row.message_id != null ? String(row.message_id) : null,
    read_at: row.read_at != null ? String(row.read_at) : null,
    created_at: String(row.created_at),
  }
}

export async function insertSalesManagerNotification(
  supabase: SupabaseClient,
  row: SalesManagerNotificationInsert,
): Promise<SalesManagerNotification | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      notification_type: row.notification_type,
      priority: row.priority,
      thread_id: row.thread_id ?? null,
      message_id: row.message_id ?? null,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '23505' && row.message_id) return null
    throw error
  }
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesManagerNotifications(
  supabase: SupabaseClient,
  options?: { unreadOnly?: boolean; limit?: number },
): Promise<SalesManagerNotification[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (options?.unreadOnly) {
    query = query.is('read_at', null)
  }
  if (options?.limit != null) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function countUnreadSalesManagerNotifications(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markSalesManagerNotificationsRead(
  supabase: SupabaseClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  const now = new Date().toISOString()
  const { error } = await supabase.from(TABLE).update({ read_at: now }).in('id', ids)
  if (error) throw error
}
