import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCoreAgentId } from '@/lib/sales/agents/agent.types'
import { runObservedSalesJobHandler } from '@/lib/sales/agents/runtime/agentJobRunner'
import { resolveCoreAgentId } from '@/lib/sales/agents/runtime/salesAgentRegistry'
import type {
  ProcessSalesJobsOptions,
  SalesJob,
  SalesJobProcessResult,
  SalesJobType,
} from '@/lib/sales/jobs/job.types'
import {
  claimSalesJob,
  completeSalesJob,
  failSalesJob,
  listPendingSalesJobs,
  listSalesJobsByIds,
  resetSalesJobForRetry,
} from '@/lib/sales/jobs/salesJobRepository'

const DEFAULT_BATCH_LIMIT = 10
const DEFAULT_MAX_ATTEMPTS = 3
const LOG_PREFIX = '[salesJobProcessor]'

const JOB_TYPE_TO_AGENT: Partial<Record<SalesJobType, SalesCoreAgentId>> = {
  business_discovery: 'business_discovery',
  contact_discovery: 'contact_discovery',
  prompt_resolution: 'prompt_resolution',
  email_generation: 'email_generation',
  quality_review: 'quality_review',
  analytics: 'analytics',
}

function jobErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export async function processSalesJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<SalesJobProcessResult> {
  const claimed = await claimSalesJob(supabase, jobId)
  if (!claimed) {
    const existing = await listSalesJobsByIds(supabase, [jobId])
    const job = existing[0]
    if (!job) {
      return {
        job_id: jobId,
        job_type: 'business_discovery',
        status: 'failed',
        error_message: 'Job not found.',
      }
    }
    return {
      job_id: job.id,
      job_type: job.job_type,
      status: job.status,
      error_message: job.error_message,
    }
  }

  const agentId = JOB_TYPE_TO_AGENT[claimed.job_type]
  if (!agentId) {
    const message = `Job handler not implemented for type: ${claimed.job_type}`
    const failed = await failSalesJob(supabase, claimed.id, message)
    return {
      job_id: failed.id,
      job_type: failed.job_type,
      status: failed.status,
      error_message: failed.error_message,
    }
  }

  try {
    const result = await runObservedSalesJobHandler(supabase, agentId, claimed)
    const completed = await completeSalesJob(supabase, claimed.id, { resultPayload: result })
    return {
      job_id: completed.id,
      job_type: completed.job_type,
      status: completed.status,
      result,
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} job handler raw error (before failSalesJob):`, error)
    const message = jobErrorMessage(error)
    const failed = await failSalesJob(supabase, claimed.id, message)
    return {
      job_id: failed.id,
      job_type: failed.job_type,
      status: failed.status,
      error_message: failed.error_message,
    }
  }
}

export async function processSalesJobs(
  supabase: SupabaseClient,
  options?: ProcessSalesJobsOptions,
): Promise<SalesJobProcessResult[]> {
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  if (options?.retryFailed) {
    const failed = await listSalesJobsByIds(supabase, options.jobIds ?? [])
    for (const job of failed) {
      if (job.status === 'failed' && job.attempts < maxAttempts) {
        await resetSalesJobForRetry(supabase, job.id)
      }
    }
  }

  let jobs: SalesJob[]
  if (options?.jobIds?.length) {
    jobs = (await listSalesJobsByIds(supabase, options.jobIds)).filter(
      (j) => j.status === 'pending',
    )
  } else {
    jobs = await listPendingSalesJobs(supabase, limit)
  }

  const toRun = jobs.slice(0, limit)
  const results: SalesJobProcessResult[] = []
  for (const job of toRun) {
    results.push(await processSalesJob(supabase, job.id))
  }
  return results
}
