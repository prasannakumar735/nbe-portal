import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesEmailQualityScore,
  SalesEmailQualityScoreInsert,
} from '@/lib/sales/types/emailQuality.types'
import type { SalesEmailQualityRecommendation } from '@/lib/sales/constants/emailQualityRecommendations'

const TABLE = 'sales_email_quality_scores'

function mapRow(row: Record<string, unknown>): SalesEmailQualityScore {
  return {
    id: String(row.id),
    generated_email_id: String(row.generated_email_id),
    spam_risk_score: Number(row.spam_risk_score ?? 0),
    personalization_score: Number(row.personalization_score ?? 0),
    sales_strength_score: Number(row.sales_strength_score ?? 0),
    grammar_score: Number(row.grammar_score ?? 0),
    overall_score: Number(row.overall_score ?? 0),
    recommendation: row.recommendation as SalesEmailQualityRecommendation,
    created_at: String(row.created_at),
  }
}

export async function getSalesEmailQualityScoreByGeneratedEmailId(
  supabase: SupabaseClient,
  generatedEmailId: string,
): Promise<SalesEmailQualityScore | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('generated_email_id', generatedEmailId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesEmailQualityScores(
  supabase: SupabaseClient,
  options?: {
    recommendation?: SalesEmailQualityRecommendation
    limit?: number
  },
): Promise<SalesEmailQualityScore[]> {
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false })

  if (options?.recommendation) {
    query = query.eq('recommendation', options.recommendation)
  }
  if (options?.limit != null) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function createSalesEmailQualityScore(
  supabase: SupabaseClient,
  row: SalesEmailQualityScoreInsert,
): Promise<SalesEmailQualityScore> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      generated_email_id: row.generated_email_id,
      spam_risk_score: row.spam_risk_score,
      personalization_score: row.personalization_score,
      sales_strength_score: row.sales_strength_score,
      grammar_score: row.grammar_score,
      overall_score: row.overall_score,
      recommendation: row.recommendation,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function upsertSalesEmailQualityScore(
  supabase: SupabaseClient,
  row: SalesEmailQualityScoreInsert,
): Promise<SalesEmailQualityScore> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        generated_email_id: row.generated_email_id,
        spam_risk_score: row.spam_risk_score,
        personalization_score: row.personalization_score,
        sales_strength_score: row.sales_strength_score,
        grammar_score: row.grammar_score,
        overall_score: row.overall_score,
        recommendation: row.recommendation,
      },
      { onConflict: 'generated_email_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
