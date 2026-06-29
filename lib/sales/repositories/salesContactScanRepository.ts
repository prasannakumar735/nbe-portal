import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesContactScanStatus } from '@/lib/sales/constants/contactScanStatuses'
import type {
  SalesContactScanLog,
  SalesContactScanLogInsert,
} from '@/lib/sales/types/contactScan.types'

const TABLE = 'sales_contact_scan_logs'

function mapRow(row: Record<string, unknown>): SalesContactScanLog {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    website: String(row.website),
    status: row.status as SalesContactScanStatus,
    emails_found: Number(row.emails_found ?? 0),
    scanned_pages: Number(row.scanned_pages ?? 0),
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: String(row.created_at),
  }
}

export async function createSalesContactScanLog(
  supabase: SupabaseClient,
  row: SalesContactScanLogInsert,
): Promise<SalesContactScanLog> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      business_id: row.business_id,
      website: row.website,
      status: row.status,
      emails_found: row.emails_found ?? 0,
      scanned_pages: row.scanned_pages ?? 0,
      error_message: row.error_message ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function completeSalesContactScanLog(
  supabase: SupabaseClient,
  id: string,
  patch: { emails_found: number; scanned_pages: number },
): Promise<SalesContactScanLog> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'completed',
      emails_found: patch.emails_found,
      scanned_pages: patch.scanned_pages,
      error_message: null,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Contact scan log not found.')
  return mapRow(data as Record<string, unknown>)
}

export async function failSalesContactScanLog(
  supabase: SupabaseClient,
  id: string,
  patch: { error_message: string },
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'failed',
      error_message: patch.error_message,
    })
    .eq('id', id)
  if (error) throw error
}

export async function listSalesContactScanLogsByBusinessId(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SalesContactScanLog[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
