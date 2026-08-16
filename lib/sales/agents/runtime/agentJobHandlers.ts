import type { SupabaseClient } from '@supabase/supabase-js'
import { executeBusinessDiscoveryJob } from '@/lib/sales/agents/businessDiscoveryExecutor'
import { executeContactDiscoveryJob } from '@/lib/sales/agents/contactDiscoveryExecutor'
import { buildEmailGenerationPromptBundle } from '@/lib/sales/generation/emailPromptBuilder'
import { scoreGeneratedEmail } from '@/lib/sales/quality/emailQualityScorer'
import { buildSalesAnalyticsDashboard } from '@/lib/sales/analytics/salesAnalyticsService'
import { computePromptPerformanceSnapshots } from '@/lib/sales/engagement/campaignEngagementAnalytics'
import { persistPromptPerformanceSnapshots } from '@/lib/sales/engagement/campaignEngagementAnalytics'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { upsertSalesEmailQualityScore } from '@/lib/sales/repositories/salesEmailQualityRepository'
import {
  parseAnalyticsJobPayload,
  parseBusinessDiscoveryJobPayload,
  parseContactDiscoveryJobPayload,
  parseEmailGenerationJobPayload,
  parsePromptResolutionJobPayload,
  parseQualityReviewJobPayload,
} from '@/lib/sales/jobs/jobPayload'
import { startEmailGenerationBatch } from '@/lib/sales/generation/emailGenerationOrchestrator'
import type { SalesJob } from '@/lib/sales/jobs/job.types'

export async function runBusinessDiscoveryAgentJob(
  supabase: SupabaseClient,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const payload = parseBusinessDiscoveryJobPayload(job.payload)
  return executeBusinessDiscoveryJob(supabase, payload)
}

export async function runContactDiscoveryAgentJob(
  supabase: SupabaseClient,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const payload = parseContactDiscoveryJobPayload(job.payload)
  return executeContactDiscoveryJob(supabase, payload)
}

export async function runPromptResolutionAgentJob(
  supabase: SupabaseClient,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const payload = parsePromptResolutionJobPayload(job.payload)
  const [campaign, business, contacts] = await Promise.all([
    getSalesCampaignById(supabase, payload.campaign_id),
    getSalesBusinessById(supabase, payload.business_id),
    listSalesContactsByIds(supabase, [payload.contact_id]),
  ])
  if (!campaign) throw new Error('Campaign not found.')
  if (!business) throw new Error('Business not found.')
  const contact = contacts[0]
  if (!contact) throw new Error('Contact not found.')

  const useCase = (payload.use_case_slug ?? 'initial_outreach') as SalesPromptUseCaseSlug
  const bundle = await buildEmailGenerationPromptBundle(supabase, {
    campaign,
    contact,
    business,
    useCaseSlug: useCase,
  })

  return {
    prompt_library_id: bundle.promptLibraryId,
    prompt_name: bundle.promptName,
    prompt_version: bundle.promptVersion,
    product_slug: bundle.product_slug,
    industry_slug: bundle.industry_slug,
    use_case_slug: bundle.use_case_slug,
    resolution_path: bundle.resolution_path,
    system_prompt_preview: bundle.systemPrompt.slice(0, 500),
    user_prompt_preview: bundle.userPrompt.slice(0, 500),
  }
}

export async function runEmailGenerationAgentJob(
  supabase: SupabaseClient,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const payload = parseEmailGenerationJobPayload(job.payload)
  const batch = await startEmailGenerationBatch(supabase, {
    campaignId: payload.campaign_id,
    provider: payload.provider,
    processImmediately: true,
    existingGenerationJobId: payload.generation_job_id,
  })
  const successCount = batch.results.filter((r) => r.outcome === 'success').length
  const failedCount = batch.results.filter((r) => r.outcome === 'failed').length
  return {
    generation_job_id: batch.job.id,
    audience_count: batch.audienceCount,
    processed_count: batch.job.processed_count,
    success_count: successCount,
    failed_count: failedCount,
    generation_job_status: batch.job.status,
  }
}

export async function runQualityReviewAgentJob(
  supabase: SupabaseClient,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const payload = parseQualityReviewJobPayload(job.payload)
  const email = await getSalesGeneratedEmailById(supabase, payload.generated_email_id)
  if (!email) throw new Error('Generated email not found.')

  const quality = scoreGeneratedEmail({
    subject: email.subject,
    body: email.body,
  })

  await upsertSalesEmailQualityScore(supabase, {
    generated_email_id: email.id,
    spam_risk_score: quality.spam_risk_score,
    personalization_score: quality.personalization_score,
    sales_strength_score: quality.sales_strength_score,
    grammar_score: quality.grammar_score,
    overall_score: quality.overall_score,
    recommendation: quality.recommendation,
  })

  return {
    generated_email_id: email.id,
    overall_score: quality.overall_score,
    recommendation: quality.recommendation,
  }
}

export async function runAnalyticsAgentJob(
  supabase: SupabaseClient,
  job: SalesJob,
): Promise<Record<string, unknown>> {
  const payload = parseAnalyticsJobPayload(job.payload)
  const dashboard = await buildSalesAnalyticsDashboard(supabase)
  let metricsSnapshotsWritten = 0
  if (payload.persist_prompt_metrics) {
    const snapshots = await computePromptPerformanceSnapshots(supabase)
    metricsSnapshotsWritten = await persistPromptPerformanceSnapshots(supabase, snapshots)
  }
  return {
    generated_at: dashboard.generatedAt,
    funnel: dashboard.funnel,
    costs: dashboard.costs,
    metrics_snapshots_written: metricsSnapshotsWritten,
  }
}
