import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesGenerationJob,
  SalesGenerationJobInsert,
  SalesGenerationJobListOptions,
  SalesGenerationJobUpdate,
} from '@/lib/sales/types/generationJob.types'
import type { SalesGenerationJobStatus } from '@/lib/sales/constants/generationJobStatuses'

const TABLE = 'sales_generation_jobs'
const PROGRESS_UPDATE_MAX_ATTEMPTS = 8

export type SalesGenerationJobProgressOutcome = 'success' | 'failed'

export class SalesGenerationJobProgressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesGenerationJobProgressError'
  }
}

function mapRow(row: Record<string, unknown>): SalesGenerationJob {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    provider: String(row.provider),
    total_contacts: Number(row.total_contacts ?? 0),
    processed_count: Number(row.processed_count ?? 0),
    success_count: Number(row.success_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
    status: row.status as SalesGenerationJobStatus,
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    created_at: String(row.created_at),
  }
}

export async function listSalesGenerationJobs(
  supabase: SupabaseClient,
  options?: SalesGenerationJobListOptions,
): Promise<SalesGenerationJob[]> {
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false })

  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.limit != null) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesGenerationJobById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGenerationJob | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesGenerationJob(
  supabase: SupabaseClient,
  row: SalesGenerationJobInsert,
): Promise<SalesGenerationJob> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      campaign_id: row.campaign_id,
      provider: row.provider,
      total_contacts: row.total_contacts,
      status: row.status ?? 'queued',
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesGenerationJob(
  supabase: SupabaseClient,
  id: string,
  patch: SalesGenerationJobUpdate,
): Promise<SalesGenerationJob> {
  const payload: Record<string, unknown> = {}
  if (patch.processed_count != null) payload.processed_count = patch.processed_count
  if (patch.success_count != null) payload.success_count = patch.success_count
  if (patch.failed_count != null) payload.failed_count = patch.failed_count
  if (patch.status != null) payload.status = patch.status
  if (patch.started_at !== undefined) payload.started_at = patch.started_at
  if (patch.completed_at !== undefined) payload.completed_at = patch.completed_at

  if (Object.keys(payload).length === 0) {
    const existing = await getSalesGenerationJobById(supabase, id)
    if (!existing) throw new Error('Generation job not found.')
    return existing
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Generation job not found.')
  return mapRow(data as Record<string, unknown>)
}

/** queued → running (optimistic lock). */
export async function startSalesGenerationJob(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGenerationJob | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function completeSalesGenerationJob(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGenerationJob> {
  return updateSalesGenerationJob(supabase, id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })
}

export async function failSalesGenerationJob(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGenerationJob> {
  return updateSalesGenerationJob(supabase, id, {
    status: 'failed',
    completed_at: new Date().toISOString(),
  })
}

export async function cancelSalesGenerationJob(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGenerationJob | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['queued', 'running'])
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

/**
 * Atomically advance batch progress (optimistic lock on processed_count).
 * Safe for concurrent async workers; retries on write conflict.
 */
export async function incrementSalesGenerationJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  outcome: SalesGenerationJobProgressOutcome,
  options?: { maxAttempts?: number },
): Promise<SalesGenerationJob> {
  const maxAttempts = options?.maxAttempts ?? PROGRESS_UPDATE_MAX_ATTEMPTS

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const job = await getSalesGenerationJobById(supabase, jobId)
    if (!job) {
      throw new SalesGenerationJobProgressError('Generation job not found.')
    }

    if (job.status !== 'running') {
      throw new SalesGenerationJobProgressError(
        `Generation job is not running (status: ${job.status}).`,
      )
    }

    if (job.processed_count >= job.total_contacts) {
      throw new SalesGenerationJobProgressError(
        'Generation job progress already reached total contacts.',
      )
    }

    const nextProcessed = job.processed_count + 1
    const nextSuccess = job.success_count + (outcome === 'success' ? 1 : 0)
    const nextFailed = job.failed_count + (outcome === 'failed' ? 1 : 0)

    if (nextProcessed > job.total_contacts) {
      throw new SalesGenerationJobProgressError(
        'Generation job progress would exceed total contacts.',
      )
    }
    if (nextSuccess + nextFailed > nextProcessed) {
      throw new SalesGenerationJobProgressError('Generation job progress counters are inconsistent.')
    }

    const payload: Record<string, unknown> = {
      processed_count: nextProcessed,
      success_count: nextSuccess,
      failed_count: nextFailed,
    }

    if (nextProcessed >= job.total_contacts) {
      payload.status = 'completed'
      payload.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', jobId)
      .eq('status', 'running')
      .eq('processed_count', job.processed_count)
      .lt('processed_count', job.total_contacts)
      .select('*')
      .maybeSingle()

    if (error) {
      if (error.code === '23514') {
        throw new SalesGenerationJobProgressError(
          'Generation job progress violates database constraints.',
        )
      }
      throw error
    }

    if (data) {
      return mapRow(data as Record<string, unknown>)
    }
  }

  throw new SalesGenerationJobProgressError(
    'Generation job progress update conflict; retry later.',
  )
}

/** @alias incrementSalesGenerationJobProgress */
export const incrementProgress = incrementSalesGenerationJobProgress
