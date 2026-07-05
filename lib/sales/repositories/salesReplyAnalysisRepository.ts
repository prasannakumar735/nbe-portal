import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesReplyAnalysisCategory, SalesReplyAnalysisStatus } from '@/lib/sales/constants/replyAnalysis'
import type {
  SalesReplyAnalysis,
  SalesReplyAnalysisInsert,
} from '@/lib/sales/types/replyManagement.types'

const TABLE = 'sales_reply_analysis'

function mapRow(row: Record<string, unknown>): SalesReplyAnalysis {
  const categories = row.categories
  return {
    id: String(row.id),
    message_id: String(row.message_id),
    analysis_version: Number(row.analysis_version),
    model_name: row.model_name != null ? String(row.model_name) : null,
    prompt_version: row.prompt_version != null ? Number(row.prompt_version) : null,
    summary: row.summary != null ? String(row.summary) : null,
    sentiment: row.sentiment != null ? String(row.sentiment) : null,
    buying_intent: row.buying_intent != null ? String(row.buying_intent) : null,
    categories: Array.isArray(categories)
      ? (categories as SalesReplyAnalysisCategory[])
      : [],
    urgency: row.urgency != null ? String(row.urgency) : null,
    suggested_next_action:
      row.suggested_next_action != null ? String(row.suggested_next_action) : null,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    analysis_status: row.analysis_status as SalesReplyAnalysisStatus,
    products_mentioned: Array.isArray(row.products_mentioned)
      ? (row.products_mentioned as string[])
      : null,
    competitors_mentioned: Array.isArray(row.competitors_mentioned)
      ? (row.competitors_mentioned as string[])
      : null,
    requested_installation_location:
      row.requested_installation_location != null
        ? String(row.requested_installation_location)
        : null,
    requested_delivery_timeframe:
      row.requested_delivery_timeframe != null
        ? String(row.requested_delivery_timeframe)
        : null,
    budget_reference: row.budget_reference != null ? String(row.budget_reference) : null,
    created_at: String(row.created_at),
  }
}

export async function getLatestSalesReplyAnalysisByMessageId(
  supabase: SupabaseClient,
  messageId: string,
): Promise<SalesReplyAnalysis | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('message_id', messageId)
    .order('analysis_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getNextSalesReplyAnalysisVersion(
  supabase: SupabaseClient,
  messageId: string,
): Promise<number> {
  const latest = await getLatestSalesReplyAnalysisByMessageId(supabase, messageId)
  return latest ? latest.analysis_version + 1 : 1
}

/** Append-only: new `analysis_version` per row (unique message_id + version). */
export async function insertSalesReplyAnalysis(
  supabase: SupabaseClient,
  row: SalesReplyAnalysisInsert,
): Promise<SalesReplyAnalysis> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      message_id: row.message_id,
      analysis_version: row.analysis_version,
      model_name: row.model_name ?? null,
      prompt_version: row.prompt_version ?? null,
      summary: row.summary ?? null,
      sentiment: row.sentiment ?? null,
      buying_intent: row.buying_intent ?? null,
      categories: row.categories ?? [],
      urgency: row.urgency ?? null,
      suggested_next_action: row.suggested_next_action ?? null,
      confidence: row.confidence ?? null,
      analysis_status: row.analysis_status ?? 'pending',
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesReplyAnalysisVersionsByMessageId(
  supabase: SupabaseClient,
  messageId: string,
): Promise<SalesReplyAnalysis[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('message_id', messageId)
    .order('analysis_version', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
