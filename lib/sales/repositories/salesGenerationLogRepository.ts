import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesGenerationLog,
  SalesGenerationLogInsert,
  SalesGenerationLogListOptions,
} from '@/lib/sales/types/generatedEmailLog.types'
import type { SalesGenerationLogStatus } from '@/lib/sales/constants/generationLogStatuses'

const TABLE = 'sales_generation_logs'

function mapRow(row: Record<string, unknown>): SalesGenerationLog {
  return {
    id: String(row.id),
    generated_email_id:
      row.generated_email_id != null ? String(row.generated_email_id) : null,
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    provider: String(row.provider),
    prompt_tokens: Number(row.prompt_tokens ?? 0),
    completion_tokens: Number(row.completion_tokens ?? 0),
    estimated_cost: Number(row.estimated_cost ?? 0),
    latency_ms: Number(row.latency_ms ?? 0),
    status: row.status as SalesGenerationLogStatus,
    failure_reason: row.failure_reason != null ? String(row.failure_reason) : null,
    created_at: String(row.created_at),
  }
}

export async function listSalesGenerationLogs(
  supabase: SupabaseClient,
  options?: SalesGenerationLogListOptions,
): Promise<SalesGenerationLog[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
  }
  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }
  if (options?.provider) {
    query = query.eq('provider', options.provider)
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

export async function getSalesGenerationLogById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGenerationLog | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesGenerationLogsByGeneratedEmailId(
  supabase: SupabaseClient,
  generatedEmailId: string,
): Promise<SalesGenerationLog[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('generated_email_id', generatedEmailId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function createSalesGenerationLog(
  supabase: SupabaseClient,
  row: SalesGenerationLogInsert,
): Promise<SalesGenerationLog> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      generated_email_id: row.generated_email_id ?? null,
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      provider: row.provider,
      prompt_tokens: row.prompt_tokens ?? 0,
      completion_tokens: row.completion_tokens ?? 0,
      estimated_cost: row.estimated_cost ?? 0,
      latency_ms: row.latency_ms ?? 0,
      status: row.status ?? 'success',
      failure_reason: row.failure_reason ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
