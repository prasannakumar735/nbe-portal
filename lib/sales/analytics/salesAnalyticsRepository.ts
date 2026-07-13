import type { SupabaseClient } from '@supabase/supabase-js'
import { estimateLlmCostUsdFromTokens } from '@/lib/sales/analytics/salesAnalyticsCostEstimates'
import type { SalesGeneratedEmailStatus } from '@/lib/sales/constants/generatedEmailStatuses'

async function countExact(supabase: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function countGeneratedEmailsByStatus(
  supabase: SupabaseClient,
  status: SalesGeneratedEmailStatus,
): Promise<number> {
  const { count, error } = await supabase
    .from('sales_generated_emails')
    .select('*', { count: 'exact', head: true })
    .eq('status', status)
  if (error) throw error
  return count ?? 0
}

export async function countSalesBusinessesDiscovered(supabase: SupabaseClient): Promise<number> {
  return countExact(supabase, 'sales_businesses')
}

export async function countSalesContactsDiscovered(supabase: SupabaseClient): Promise<number> {
  return countExact(supabase, 'sales_contacts')
}

export async function countSalesGeneratedEmails(supabase: SupabaseClient): Promise<number> {
  return countExact(supabase, 'sales_generated_emails')
}

export async function countSalesGeneratedEmailsApproved(supabase: SupabaseClient): Promise<number> {
  const [approved, queued] = await Promise.all([
    countGeneratedEmailsByStatus(supabase, 'approved'),
    countGeneratedEmailsByStatus(supabase, 'queued'),
  ])
  return approved + queued
}

export async function countSalesGeneratedEmailsSent(supabase: SupabaseClient): Promise<number> {
  return countGeneratedEmailsByStatus(supabase, 'sent')
}

export async function sumSalesGenerationLogAiCostUsd(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('sales_generation_logs')
    .select('estimated_cost, prompt_tokens, completion_tokens')
    .limit(50_000)
  if (error) throw error
  let logged = 0
  let promptTokens = 0
  let completionTokens = 0
  for (const row of data ?? []) {
    const r = row as {
      estimated_cost?: number
      prompt_tokens?: number
      completion_tokens?: number
    }
    logged += Number(r.estimated_cost ?? 0)
    promptTokens += Number(r.prompt_tokens ?? 0)
    completionTokens += Number(r.completion_tokens ?? 0)
  }
  if (logged > 0) return Math.round(logged * 1_000_000) / 1_000_000
  return estimateLlmCostUsdFromTokens(promptTokens, completionTokens)
}

export async function sumSalesGenerationLogAiCostUsdByCampaign(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('sales_generation_logs')
    .select('campaign_id, estimated_cost, prompt_tokens, completion_tokens')
    .limit(50_000)
  if (error) throw error
  const map = new Map<string, number>()
  let anyLoggedCost = false
  const tokenMap = new Map<string, { prompt: number; completion: number }>()
  for (const row of data ?? []) {
    const r = row as {
      campaign_id: string
      estimated_cost?: number
      prompt_tokens?: number
      completion_tokens?: number
    }
    const cost = Number(r.estimated_cost ?? 0)
    if (cost > 0) anyLoggedCost = true
    map.set(r.campaign_id, (map.get(r.campaign_id) ?? 0) + cost)
    const tokens = tokenMap.get(r.campaign_id) ?? { prompt: 0, completion: 0 }
    tokens.prompt += Number(r.prompt_tokens ?? 0)
    tokens.completion += Number(r.completion_tokens ?? 0)
    tokenMap.set(r.campaign_id, tokens)
  }
  if (anyLoggedCost) return map
  const estimated = new Map<string, number>()
  for (const [campaignId, tokens] of tokenMap) {
    estimated.set(
      campaignId,
      estimateLlmCostUsdFromTokens(tokens.prompt, tokens.completion),
    )
  }
  return estimated
}

export async function countCompletedSalesScanRuns(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('sales_scan_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
  if (error) throw error
  return count ?? 0
}

export type EngagementSummaryTotals = {
  contactsDelivered: number
  contactsOpened: number
  contactsReplied: number
}

export async function sumSalesContactEngagementFlags(
  supabase: SupabaseClient,
): Promise<EngagementSummaryTotals> {
  const { data, error } = await supabase
    .from('sales_contact_engagement')
    .select('delivered, opened, reply_detected')
    .limit(50_000)
  if (error) throw error
  let contactsDelivered = 0
  let contactsOpened = 0
  let contactsReplied = 0
  for (const row of data ?? []) {
    const r = row as { delivered?: boolean; opened?: boolean; reply_detected?: boolean }
    if (r.delivered) contactsDelivered += 1
    if (r.opened) contactsOpened += 1
    if (r.reply_detected) contactsReplied += 1
  }
  return { contactsDelivered, contactsOpened, contactsReplied }
}

export async function countSalesEngagementRepliesByCampaign(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('sales_engagement_events')
    .select('campaign_id')
    .eq('event_type', 'replied')
    .limit(50_000)
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const id = String((row as { campaign_id: string }).campaign_id)
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
}

export async function countSalesGeneratedEmailsSentByCampaign(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('sales_generated_emails')
    .select('campaign_id')
    .eq('status', 'sent')
    .limit(50_000)
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const id = String((row as { campaign_id: string }).campaign_id)
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
}

export async function sumWonPipelineRevenueAudByCampaign(
  supabase: SupabaseClient,
): Promise<{ totalAud: number; byCampaign: Map<string, number> }> {
  const { data, error } = await supabase
    .from('sales_pipeline_opportunities')
    .select('campaign_id, revenue_cents, stage')
    .eq('stage', 'won')
    .limit(50_000)
  if (error) throw error
  let totalCents = 0
  const byCampaign = new Map<string, number>()
  for (const row of data ?? []) {
    const r = row as { campaign_id: string | null; revenue_cents: number }
    const cents = Number(r.revenue_cents ?? 0)
    totalCents += cents
    if (r.campaign_id) {
      byCampaign.set(r.campaign_id, (byCampaign.get(r.campaign_id) ?? 0) + cents / 100)
    }
  }
  return { totalAud: totalCents / 100, byCampaign }
}

export async function listSalesBusinessCategorySuburbSamples(
  supabase: SupabaseClient,
  limit = 10_000,
): Promise<{ category: string | null; suburb: string | null }[]> {
  const { data, error } = await supabase
    .from('sales_businesses')
    .select('category, suburb')
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as { category: string | null; suburb: string | null }
    return { category: r.category, suburb: r.suburb }
  })
}

export async function listSalesCampaignNames(
  supabase: SupabaseClient,
  limit = 500,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('sales_campaigns')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as { id: string; name: string }
    return { id: String(r.id), name: String(r.name) }
  })
}

function rankGrouped(
  rows: { key: string; label: string }[],
  topN: number,
): { key: string; label: string; count: number }[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const row of rows) {
    const key = row.key.trim() || 'unknown'
    const label = row.label.trim() || 'Unknown'
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { label, count: 1 })
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((v) => ({ key: v.label.toLowerCase(), label: v.label, count: v.count }))
}

export function buildTopIndustriesFromBusinessRows(
  rows: { category: string | null }[],
  topN = 8,
) {
  return rankGrouped(
    rows.map((r) => ({
      key: (r.category ?? 'uncategorized').toLowerCase(),
      label: r.category?.trim() || 'Uncategorized',
    })),
    topN,
  )
}

export function buildTopSuburbsFromBusinessRows(rows: { suburb: string | null }[], topN = 8) {
  return rankGrouped(
    rows.map((r) => ({
      key: (r.suburb ?? 'unknown').toLowerCase(),
      label: r.suburb?.trim() || 'Unknown',
    })),
    topN,
  )
}
