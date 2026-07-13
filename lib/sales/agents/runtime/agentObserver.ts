import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCoreAgentId } from '@/lib/sales/agents/agent.types'
import type { SalesAgentQueueKind } from '@/lib/sales/agents/runtime/agentRuntime.types'
import {
  completeSalesAgentRun,
  createSalesAgentRun,
  failSalesAgentRun,
} from '@/lib/sales/repositories/salesAgentRunRepository'

const LOG_PREFIX = '[salesAgent]'

export async function observeAgentExecution<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  input: {
    agentId: SalesCoreAgentId
    queueKind: SalesAgentQueueKind
    referenceId?: string | null
    runInput?: Record<string, unknown>
    execute: () => Promise<T>
  },
): Promise<{ output: T; durationMs: number; runId: string | null }> {
  const startedAt = Date.now()
  let runId: string | null = null

  try {
    const run = await createSalesAgentRun(supabase, {
      agent_id: input.agentId,
      queue_kind: input.queueKind,
      reference_id: input.referenceId ?? null,
      input: input.runInput ?? {},
    })
    runId = run.id
  } catch (error) {
    console.warn(`${LOG_PREFIX} observability insert skipped:`, error)
  }

  try {
    const output = await input.execute()
    const durationMs = Math.max(0, Date.now() - startedAt)
    if (runId) {
      await completeSalesAgentRun(supabase, runId, { output, duration_ms: durationMs })
    }
    console.info(`${LOG_PREFIX} completed`, {
      agentId: input.agentId,
      referenceId: input.referenceId,
      durationMs,
    })
    return { output, durationMs, runId }
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startedAt)
    const message = error instanceof Error ? error.message : String(error)
    if (runId) {
      await failSalesAgentRun(supabase, runId, { error_message: message, duration_ms: durationMs })
    }
    console.error(`${LOG_PREFIX} failed`, {
      agentId: input.agentId,
      referenceId: input.referenceId,
      message,
    })
    throw error
  }
}
