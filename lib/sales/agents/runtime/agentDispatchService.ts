import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCoreAgentId } from '@/lib/sales/agents/agent.types'
import { observeAgentExecution } from '@/lib/sales/agents/runtime/agentObserver'
import {
  getSalesAgentDefinition,
  jobTypeForAgent,
  resolveCoreAgentId,
} from '@/lib/sales/agents/runtime/salesAgentRegistry'
import type {
  SalesAgentDispatchOptions,
  SalesAgentDispatchResult,
  SalesAgentStatusSnapshot,
} from '@/lib/sales/agents/runtime/agentRuntime.types'
import { dispatchEmailSendQueue } from '@/lib/sales/sending/emailSendQueueDispatcher'
import { dispatchFollowupQueue } from '@/lib/sales/followup/followupQueueDispatcher'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import { listPendingSalesJobs } from '@/lib/sales/jobs/salesJobRepository'
import { listQueuedSalesEmailSendItems } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { listDueScheduledSalesFollowupQueue } from '@/lib/sales/repositories/salesFollowupQueueRepository'
import type { SalesJobType } from '@/lib/sales/jobs/job.types'
import { SALES_CORE_AGENT_IDS } from '@/lib/sales/agents/agent.types'

async function countPendingJobsForType(
  supabase: SupabaseClient,
  jobType: SalesJobType,
): Promise<number> {
  const { count, error } = await supabase
    .from('sales_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('job_type', jobType)
  if (error) throw error
  return count ?? 0
}

export async function getSalesAgentStatusBoard(
  supabase: SupabaseClient,
): Promise<SalesAgentStatusSnapshot[]> {
  const snapshots: SalesAgentStatusSnapshot[] = []

  for (const agentId of SALES_CORE_AGENT_IDS) {
    const def = getSalesAgentDefinition(agentId)
    let pendingCount: number | null = null

    if (def.queueKind === 'sales_jobs' && def.jobType) {
      pendingCount = await countPendingJobsForType(supabase, def.jobType)
    } else if (def.id === 'queue') {
      const rows = await listQueuedSalesEmailSendItems(supabase, 500)
      pendingCount = rows.length
    } else if (def.id === 'followup') {
      const rows = await listDueScheduledSalesFollowupQueue(supabase, 500)
      pendingCount = rows.length
    }

    snapshots.push({
      agentId: def.id,
      queueKind: def.queueKind,
      pendingCount,
    })
  }

  return snapshots
}

export async function dispatchSalesAgent(
  supabase: SupabaseClient,
  rawAgentId: string,
  options?: SalesAgentDispatchOptions,
): Promise<SalesAgentDispatchResult> {
  const agentId = resolveCoreAgentId(rawAgentId)
  if (!agentId) {
    throw new Error(`Unknown agent: ${rawAgentId}`)
  }

  const limit = options?.limit ?? 10
  const results: SalesAgentDispatchResult['results'] = []

  if (agentId === 'queue') {
    const dispatch = await observeAgentExecution(supabase, {
      agentId: 'queue',
      queueKind: 'email_send_queue',
      runInput: { limit, queueIds: options?.queueIds },
      execute: async () => {
        const out = await dispatchEmailSendQueue(supabase, {
          limit,
          queueIds: options?.queueIds,
          maxAttempts: options?.maxAttempts,
        })
        return out as unknown as Record<string, unknown>
      },
    })
    const payload = dispatch.output as { results?: { queueId: string; outcome: string }[] }
    for (const row of payload.results ?? []) {
      results.push({
        agentId: 'queue',
        referenceId: row.queueId,
        status: row.outcome === 'sent' ? 'completed' : 'failed',
        durationMs: dispatch.durationMs,
        output: row as unknown as Record<string, unknown>,
      })
    }
    return { agentId, processed: results.length, results }
  }

  if (agentId === 'followup') {
    const dispatch = await observeAgentExecution(supabase, {
      agentId: 'followup',
      queueKind: 'followup_queue',
      runInput: { limit, queueIds: options?.queueIds },
      execute: async () => {
        const out = await dispatchFollowupQueue(supabase, {
          limit,
          queueIds: options?.queueIds,
        })
        return out as unknown as Record<string, unknown>
      },
    })
    const payload = dispatch.output as { results?: { queueId: string; outcome: string }[] }
    for (const row of payload.results ?? []) {
      results.push({
        agentId: 'followup',
        referenceId: row.queueId,
        status: row.outcome === 'awaiting_review' || row.outcome === 'queued' ? 'completed' : 'failed',
        durationMs: dispatch.durationMs,
        output: row as unknown as Record<string, unknown>,
      })
    }
    return { agentId, processed: results.length, results }
  }

  const jobType = jobTypeForAgent(agentId)
  if (!jobType) {
    throw new Error(`Agent ${agentId} has no job mapping.`)
  }

  let jobIds = options?.jobIds
  if (!jobIds?.length) {
    const pending = await listPendingSalesJobs(supabase, limit * 3)
    jobIds = pending.filter((j) => j.job_type === jobType).slice(0, limit).map((j) => j.id)
  }

  const processed = await processSalesJobs(supabase, {
    jobIds,
    limit,
    retryFailed: options?.retryFailed,
    maxAttempts: options?.maxAttempts,
  })

  for (const row of processed) {
    const status = row.status === 'completed' ? 'completed' : 'failed'
    results.push({
      agentId,
      referenceId: row.job_id,
      status,
      errorMessage: row.error_message,
      durationMs: 0,
      output: (row.result ?? {}) as Record<string, unknown>,
    })
  }

  return { agentId, processed: results.length, results }
}
