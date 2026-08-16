import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesScanRun,
  SalesScanRunInsert,
  SalesScanRunStatus,
} from '@/lib/sales/types/scanRun.types'

const TABLE = 'sales_scan_runs'

function mapRow(row: Record<string, unknown>): SalesScanRun {
  return {
    id: String(row.id),
    postcode: String(row.postcode),
    status: row.status as SalesScanRunStatus,
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    total_found: Number(row.total_found ?? 0),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}

export async function createSalesScanRun(
  supabase: SupabaseClient,
  row: SalesScanRunInsert,
): Promise<SalesScanRun> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      postcode: row.postcode,
      status: row.status,
      started_at: row.started_at ?? new Date().toISOString(),
      completed_at: row.completed_at ?? null,
      total_found: row.total_found ?? 0,
      created_by: row.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function completeSalesScanRun(
  supabase: SupabaseClient,
  id: string,
  patch: { status: SalesScanRunStatus; total_found: number; completed_at?: string },
): Promise<SalesScanRun> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: patch.status,
      total_found: patch.total_found,
      completed_at: patch.completed_at ?? new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Scan run not found.')
  return mapRow(data as Record<string, unknown>)
}

export async function failSalesScanRun(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function listSalesScanRunsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<SalesScanRun[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from(TABLE).select('*').in('id', ids)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
