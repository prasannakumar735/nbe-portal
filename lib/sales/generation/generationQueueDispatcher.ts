import type { SupabaseClient } from '@supabase/supabase-js'
import { startEmailGenerationBatch } from '@/lib/sales/generation/emailGenerationOrchestrator'
import type { SalesJob, SalesJobProcessResult } from '@/lib/sales/jobs/job.types'
import { parseEmailGenerationJobPayload } from '@/lib/sales/jobs/jobPayload'
import {
  claimSalesJob,
  completeSalesJob,
  failSalesJob,
  getSalesJobById,
  listSalesJobsByIds,
} from '@/lib/sales/jobs/salesJobRepository'

const DEFAULT_POLL_LIMIT = 10

export type DispatchEmailGenerationQueueOptions = {
  limit?: number
  jobIds?: string[]
}

export type EmailGenerationQueueDispatchResult = SalesJobProcessResult & {
  generation_job_id?: string
}

function mapSalesJobRow(row: Record<string, unknown>): SalesJob {
  const payload = row.payload
  return {
    id: String(row.id),
    job_type: row.job_type as SalesJob['job_type'],
    payload:
      payload != null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
    status: row.status as SalesJob['status'],
    attempts: Number(row.attempts ?? 0),
    error_message: row.error_message != null ? String(row.error_message) : null,
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    created_at: String(row.created_at),
  }
}

async function listPendingEmailGenerationJobs(
  supabase: SupabaseClient,
  limit: number,
): Promise<SalesJob[]> {
  const { data, error } = await supabase
    .from('sales_jobs')
    .select('*')
    .eq('job_type', 'email_generation')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => mapSalesJobRow(row as Record<string, unknown>))
}

function summarizeBatchResult(result: Awaited<ReturnType<typeof startEmailGenerationBatch>>) {
  const successCount = result.results.filter((r) => r.outcome === 'success').length
  const failedCount = result.results.filter((r) => r.outcome === 'failed').length
  return {
    generation_job_id: result.job.id,
    audience_count: result.audienceCount,
    processed_count: result.job.processed_count,
    success_count: successCount,
    failed_count: failedCount,
    generation_job_status: result.job.status,
  }
}

/**
 * Claim and execute one email_generation sales_jobs row (idempotent claim via pending → running).
 */
export async function processEmailGenerationQueueJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<EmailGenerationQueueDispatchResult> {
  const claimed = await claimSalesJob(supabase, jobId)
  if (!claimed) {
    const existing = await getSalesJobById(supabase, jobId)
    if (!existing) {
      return {
        job_id: jobId,
        job_type: 'email_generation',
        status: 'failed',
        error_message: 'Job not found.',
      }
    }
    return {
      job_id: existing.id,
      job_type: existing.job_type,
      status: existing.status,
      error_message: existing.error_message,
    }
  }

  if (claimed.job_type !== 'email_generation') {
    await failSalesJob(supabase, claimed.id, 'Unexpected job type for email generation dispatcher.')
    return {
      job_id: claimed.id,
      job_type: claimed.job_type,
      status: 'failed',
      error_message: 'Unexpected job type for email generation dispatcher.',
    }
  }

  try {
    const payload = parseEmailGenerationJobPayload(claimed.payload)
    const batch = await startEmailGenerationBatch(supabase, {
      campaignId: payload.campaign_id,
      provider: payload.provider,
      processImmediately: true,
      existingGenerationJobId: payload.generation_job_id,
    })

    const resultPayload = summarizeBatchResult(batch)
    const completed = await completeSalesJob(supabase, claimed.id, { resultPayload })

    return {
      job_id: completed.id,
      job_type: completed.job_type,
      status: completed.status,
      result: resultPayload,
      generation_job_id: batch.job.id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email generation queue job failed.'
    const failed = await failSalesJob(supabase, claimed.id, message)
    return {
      job_id: failed.id,
      job_type: failed.job_type,
      status: failed.status,
      error_message: failed.error_message,
    }
  }
}

/**
 * Poll pending email_generation jobs and dispatch batch workers sequentially.
 */
export async function dispatchEmailGenerationQueue(
  supabase: SupabaseClient,
  options?: DispatchEmailGenerationQueueOptions,
): Promise<EmailGenerationQueueDispatchResult[]> {
  const limit = options?.limit ?? DEFAULT_POLL_LIMIT

  let jobs: SalesJob[]
  if (options?.jobIds?.length) {
    jobs = (await listSalesJobsByIds(supabase, options.jobIds)).filter(
      (job) => job.job_type === 'email_generation' && job.status === 'pending',
    )
  } else {
    jobs = await listPendingEmailGenerationJobs(supabase, limit)
  }

  const results: EmailGenerationQueueDispatchResult[] = []
  for (const job of jobs.slice(0, limit)) {
    results.push(await processEmailGenerationQueueJob(supabase, job.id))
  }
  return results
}
