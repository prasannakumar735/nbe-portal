import type { SupabaseClient } from '@supabase/supabase-js'
import { executeBusinessDiscoveryJob } from '@/lib/sales/agents/businessDiscoveryExecutor'
import { executeContactDiscoveryJob } from '@/lib/sales/agents/contactDiscoveryExecutor'
import type {
  ProcessSalesJobsOptions,
  SalesJob,
  SalesJobProcessResult,
  SalesJobType,
} from '@/lib/sales/jobs/job.types'
import {
  parseBusinessDiscoveryJobPayload,
  parseContactDiscoveryJobPayload,
} from '@/lib/sales/jobs/jobPayload'
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

type JobHandler = (
  supabase: SupabaseClient,
  job: SalesJob,
) => Promise<Record<string, unknown>>

const JOB_HANDLERS: Partial<Record<SalesJobType, JobHandler>> = {
  business_discovery: async (supabase, job) => {
    const payload = parseBusinessDiscoveryJobPayload(job.payload)
    return executeBusinessDiscoveryJob(supabase, payload)
  },
  contact_discovery: async (supabase, job) => {
    const payload = parseContactDiscoveryJobPayload(job.payload)
    return executeContactDiscoveryJob(supabase, payload)
  },
}

function notImplementedHandler(jobType: SalesJobType): JobHandler {
  return async () => {
    throw new Error(`Job handler not implemented for type: ${jobType}`)
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

  const handler = JOB_HANDLERS[claimed.job_type] ?? notImplementedHandler(claimed.job_type)

  try {
    const result = await handler(supabase, claimed)
    const completed = await completeSalesJob(supabase, claimed.id, { resultPayload: result })
    return {
      job_id: completed.id,
      job_type: completed.job_type,
      status: completed.status,
      result,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job processing failed'
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
