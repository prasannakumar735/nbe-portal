import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesJob,
  SalesJobInsert,
  SalesJobStatus,
  SalesJobType,
} from '@/lib/sales/jobs/job.types'

const TABLE = 'sales_jobs'

function mapRow(row: Record<string, unknown>): SalesJob {
  const payload = row.payload
  return {
    id: String(row.id),
    job_type: row.job_type as SalesJobType,
    payload:
      payload != null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
    status: row.status as SalesJobStatus,
    attempts: Number(row.attempts ?? 0),
    error_message: row.error_message != null ? String(row.error_message) : null,
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    created_at: String(row.created_at),
  }
}

export async function createSalesJob(
  supabase: SupabaseClient,
  row: SalesJobInsert,
): Promise<SalesJob> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      job_type: row.job_type,
      payload: row.payload,
      status: row.status ?? 'pending',
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesJobs(
  supabase: SupabaseClient,
  rows: SalesJobInsert[],
): Promise<SalesJob[]> {
  if (rows.length === 0) return []
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      rows.map((r) => ({
        job_type: r.job_type,
        payload: r.payload,
        status: r.status ?? 'pending',
      })),
    )
    .select('*')
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesJobById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesJob | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listPendingSalesJobs(
  supabase: SupabaseClient,
  limit: number,
): Promise<SalesJob[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function listSalesJobsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<SalesJob[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from(TABLE).select('*').in('id', ids)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

/**
 * Atomically move pending → running (optimistic lock on status).
 */
export async function claimSalesJob(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesJob | null> {
  const existing = await getSalesJobById(supabase, id)
  if (!existing || existing.status !== 'pending') {
    return null
  }

  const nextAttempts = existing.attempts + 1
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      attempts: nextAttempts,
      error_message: null,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function completeSalesJob(
  supabase: SupabaseClient,
  id: string,
  options?: { resultPayload?: Record<string, unknown> },
): Promise<SalesJob> {
  const patch: Record<string, unknown> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    error_message: null,
  }
  if (options?.resultPayload) {
    const job = await getSalesJobById(supabase, id)
    if (!job) throw new Error('Job not found.')
    patch.payload = { ...job.payload, _result: options.resultPayload }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Job not found.')
  return mapRow(data as Record<string, unknown>)
}

export async function failSalesJob(
  supabase: SupabaseClient,
  id: string,
  errorMessage: string,
): Promise<SalesJob> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 2000),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Job not found.')
  return mapRow(data as Record<string, unknown>)
}

export async function resetSalesJobForRetry(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesJob | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'pending',
      started_at: null,
      completed_at: null,
      error_message: null,
    })
    .eq('id', id)
    .eq('status', 'failed')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}
