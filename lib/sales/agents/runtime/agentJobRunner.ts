import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCoreAgentId } from '@/lib/sales/agents/agent.types'
import { observeAgentExecution } from '@/lib/sales/agents/runtime/agentObserver'
import {
  runAnalyticsAgentJob,
  runBusinessDiscoveryAgentJob,
  runContactDiscoveryAgentJob,
  runEmailGenerationAgentJob,
  runPromptResolutionAgentJob,
  runQualityReviewAgentJob,
} from '@/lib/sales/agents/runtime/agentJobHandlers'
import { getSalesAgentDefinition } from '@/lib/sales/agents/runtime/salesAgentRegistry'
import type { SalesJob } from '@/lib/sales/jobs/job.types'

const AGENT_JOB_RUNNERS: Partial<
  Record<SalesCoreAgentId, (supabase: SupabaseClient, job: SalesJob) => Promise<Record<string, unknown>>>
> = {
  business_discovery: runBusinessDiscoveryAgentJob,
  contact_discovery: runContactDiscoveryAgentJob,
  prompt_resolution: runPromptResolutionAgentJob,
  email_generation: runEmailGenerationAgentJob,
  quality_review: runQualityReviewAgentJob,
  analytics: runAnalyticsAgentJob,
}

export async function runObservedSalesJobHandler(
  supabase: SupabaseClient,
  agentId: SalesCoreAgentId,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const def = getSalesAgentDefinition(agentId)
  const handler = AGENT_JOB_RUNNERS[agentId]
  if (!handler) {
    throw new Error(`No handler for agent ${agentId}`)
  }
  const observed = await observeAgentExecution(supabase, {
    agentId,
    queueKind: def.queueKind,
    referenceId: job.id,
    runInput: { job_type: job.job_type, payload: job.payload },
    execute: () => handler(supabase, job),
  })
  return observed.output
}
