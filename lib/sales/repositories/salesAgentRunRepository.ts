import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesAgentRunStatus,
  SalesAgentQueueKind,
} from '@/lib/sales/agents/runtime/agentRuntime.types'

const TABLE = 'sales_agent_runs'

export type SalesAgentRun = {
  id: string
  agent_id: string
  queue_kind: SalesAgentQueueKind
  reference_id: string | null
  status: SalesAgentRunStatus
  input: Record<string, unknown>
  output: Record<string, unknown>
  error_message: string | null
  duration_ms: number
  started_at: string
  completed_at: string | null
}

function mapRow(row: Record<string, unknown>): SalesAgentRun {
  const input = row.input
  const output = row.output
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    queue_kind: row.queue_kind as SalesAgentQueueKind,
    reference_id: row.reference_id != null ? String(row.reference_id) : null,
    status: row.status as SalesAgentRunStatus,
    input:
      input != null && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {},
    output:
      output != null && typeof output === 'object' && !Array.isArray(output)
        ? (output as Record<string, unknown>)
        : {},
    error_message: row.error_message != null ? String(row.error_message) : null,
    duration_ms: Number(row.duration_ms ?? 0),
    started_at: String(row.started_at),
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
  }
}

export async function createSalesAgentRun(
  supabase: SupabaseClient,
  row: {
    agent_id: string
    queue_kind: SalesAgentQueueKind
    reference_id?: string | null
    input?: Record<string, unknown>
  },
): Promise<SalesAgentRun> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      agent_id: row.agent_id,
      queue_kind: row.queue_kind,
      reference_id: row.reference_id ?? null,
      status: 'running',
      input: row.input ?? {},
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function completeSalesAgentRun(
  supabase: SupabaseClient,
  id: string,
  patch: { output?: Record<string, unknown>; duration_ms: number },
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'completed',
      output: patch.output ?? {},
      duration_ms: patch.duration_ms,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function failSalesAgentRun(
  supabase: SupabaseClient,
  id: string,
  patch: { error_message: string; duration_ms: number },
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'failed',
      error_message: patch.error_message.slice(0, 2000),
      duration_ms: patch.duration_ms,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function listRecentSalesAgentRuns(
  supabase: SupabaseClient,
  options?: { agentId?: string; limit?: number },
): Promise<SalesAgentRun[]> {
  let query = supabase.from(TABLE).select('*').order('started_at', { ascending: false })
  if (options?.agentId) query = query.eq('agent_id', options.agentId)
  if (options?.limit != null) query = query.limit(options.limit)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
