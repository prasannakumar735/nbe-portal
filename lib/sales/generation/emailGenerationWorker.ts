import type { SupabaseClient } from '@supabase/supabase-js'
import { isLLMProviderId, type LLMProviderId } from '@/lib/sales/constants/llmProviders'
import { buildEmailGenerationPromptBundle } from '@/lib/sales/generation/emailPromptBuilder'
import { classifyGenerationFailure } from '@/lib/sales/generation/generationFailureClassifier'
import { executeProviderGeneration } from '@/lib/sales/generation/providerExecutionAdapter'
import { scoreGeneratedEmail } from '@/lib/sales/quality/emailQualityScorer'
import {
  assertProviderRequestAllowed,
  recordProviderRequest,
} from '@/lib/sales/rate-limit/providerRateLimiter'
import {
  createSalesGeneratedEmail,
  getNextSalesGeneratedEmailVersion,
} from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { copyOfferAttachmentsToGeneratedEmail } from '@/lib/sales/attachments/salesBrochureStorage'
import { createSalesGenerationLog } from '@/lib/sales/repositories/salesGenerationLogRepository'
import {
  incrementSalesGenerationJobProgress,
  type SalesGenerationJobProgressOutcome,
} from '@/lib/sales/repositories/salesGenerationJobRepository'
import { upsertSalesEmailQualityScore } from '@/lib/sales/repositories/salesEmailQualityRepository'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesGenerationJob } from '@/lib/sales/types/generationJob.types'

export type EmailGenerationWorkerInput = {
  job: SalesGenerationJob
  campaign: SalesCampaign
  provider: LLMProviderId
  contact: SalesContact
  business: SalesBusiness
  /** When set, links regeneration to the prior generated email row. */
  parentGeneratedEmailId?: string | null
}

export type EmailGenerationWorkerResult = {
  contactId: string
  outcome: SalesGenerationJobProgressOutcome
  generatedEmailId?: string
  errorMessage?: string
}

/**
 * Generate one outreach email for a campaign contact (Phase 5 worker unit).
 */
export async function processEmailGenerationForContact(
  supabase: SupabaseClient,
  input: EmailGenerationWorkerInput,
): Promise<EmailGenerationWorkerResult> {
  const { job, campaign, provider, contact, business, parentGeneratedEmailId } = input
  const startedAt = Date.now()
  let userPrompt = ''
  let systemPrompt = ''

  try {
    assertProviderRequestAllowed(provider)
    recordProviderRequest(provider)

    const bundle = await buildEmailGenerationPromptBundle(supabase, { campaign, contact, business })
    userPrompt = bundle.userPrompt
    systemPrompt = bundle.systemPrompt

    const execution = await executeProviderGeneration({
      provider,
      prompt: userPrompt,
      systemPrompt,
    })
    const { content } = execution

    const version = await getNextSalesGeneratedEmailVersion(supabase, {
      campaignId: campaign.id,
      contactId: contact.id,
    })

    const savedEmail = await createSalesGeneratedEmail(supabase, {
      campaign_id: campaign.id,
      contact_id: contact.id,
      subject: content.subject,
      body: content.body,
      generation_provider: content.provider || provider,
      status: 'draft',
      version,
      parent_generated_email_id: parentGeneratedEmailId ?? null,
      sequence_position: 0,
      prompt_name: bundle.promptName,
      prompt_version: bundle.promptVersion,
      prompt_library_id: bundle.promptLibraryId,
    })

    await copyOfferAttachmentsToGeneratedEmail(supabase, {
      generatedEmailId: savedEmail.id,
      offerTypeId: campaign.offer_type_id,
    })

    await createSalesGenerationLog(supabase, {
      generated_email_id: savedEmail.id,
      campaign_id: campaign.id,
      contact_id: contact.id,
      provider,
      prompt_tokens: execution.promptTokens,
      completion_tokens: execution.completionTokens,
      latency_ms: execution.latencyMs,
      status: 'success',
    })

    const quality = scoreGeneratedEmail({
      subject: savedEmail.subject,
      body: savedEmail.body,
    })

    await upsertSalesEmailQualityScore(supabase, {
      generated_email_id: savedEmail.id,
      spam_risk_score: quality.spam_risk_score,
      personalization_score: quality.personalization_score,
      sales_strength_score: quality.sales_strength_score,
      grammar_score: quality.grammar_score,
      overall_score: quality.overall_score,
      recommendation: quality.recommendation,
    })

    await incrementSalesGenerationJobProgress(supabase, job.id, 'success')

    return {
      contactId: contact.id,
      outcome: 'success',
      generatedEmailId: savedEmail.id,
    }
  } catch (error) {
    const { status, failureReason } = classifyGenerationFailure(error)
    const latencyMs = Date.now() - startedAt

    await createSalesGenerationLog(supabase, {
      generated_email_id: null,
      campaign_id: campaign.id,
      contact_id: contact.id,
      provider,
      latency_ms: latencyMs,
      status,
      failure_reason: failureReason,
    })

    await incrementSalesGenerationJobProgress(supabase, job.id, 'failed')

    return {
      contactId: contact.id,
      outcome: 'failed',
      errorMessage: failureReason,
    }
  }
}

export function assertEmailGenerationProvider(provider: string): asserts provider is LLMProviderId {
  if (!isLLMProviderId(provider)) {
    throw new Error(`Unknown LLM provider: ${provider}`)
  }
}
