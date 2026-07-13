import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesAgentId } from '@/lib/sales/agents/agent.types'
import { resolveDefaultSalesLlmProvider } from '@/lib/sales/constants/llmProviders'
import { startEmailGenerationBatch } from '@/lib/sales/generation/emailGenerationOrchestrator'
import { processEmailGenerationQueueJob } from '@/lib/sales/generation/generationQueueDispatcher'
import type { SalesJob, SalesJobProcessResult } from '@/lib/sales/jobs/job.types'
import { createSalesJob, listSalesJobsByIds } from '@/lib/sales/jobs/salesJobRepository'
import { getSalesGenerationJobById } from '@/lib/sales/repositories/salesGenerationJobRepository'
import type { SalesGenerationJob } from '@/lib/sales/types/generationJob.types'

export const EMAIL_GENERATION_AGENT_ID: SalesAgentId = 'email_generation'

export type EmailGenerationAgentInput = {
  campaignId: string
  createdBy: string
  provider?: string
  processImmediately?: boolean
  contactIds?: string[]
}

export type EmailGenerationAgentResult = {
  job: SalesJob
  generationJob: SalesGenerationJob | null
  audienceCount: number
  processResult?: SalesJobProcessResult
}

export async function runEmailGenerationAgent(
  supabase: SupabaseClient,
  input: EmailGenerationAgentInput,
): Promise<EmailGenerationAgentResult> {
  const provider = input.provider?.trim() || resolveDefaultSalesLlmProvider()
  const processImmediately = input.processImmediately !== false

  const batchPreview = await startEmailGenerationBatch(supabase, {
    campaignId: input.campaignId,
    provider,
    processImmediately: false,
    contactIds: input.contactIds,
  })

  const salesJob = await createSalesJob(supabase, {
    job_type: 'email_generation',
    payload: {
      campaign_id: input.campaignId,
      provider,
      created_by: input.createdBy,
      generation_job_id: batchPreview.job.id,
    },
  })

  if (!processImmediately) {
    return {
      job: salesJob,
      generationJob: batchPreview.job,
      audienceCount: batchPreview.audienceCount,
    }
  }

  const processResult = await processEmailGenerationQueueJob(supabase, salesJob.id)
  const refreshedJobs = await listSalesJobsByIds(supabase, [salesJob.id])
  const refreshedJob = refreshedJobs[0] ?? salesJob

  const generationJobId =
    processResult.result &&
    typeof processResult.result === 'object' &&
    processResult.result !== null &&
    'generation_job_id' in processResult.result
      ? String((processResult.result as { generation_job_id: string }).generation_job_id)
      : batchPreview.job.id

  const generationJob = await getSalesGenerationJobById(supabase, generationJobId)

  return {
    job: refreshedJob,
    generationJob,
    audienceCount: batchPreview.audienceCount,
    processResult,
  }
}
