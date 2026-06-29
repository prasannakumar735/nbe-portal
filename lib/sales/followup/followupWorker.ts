import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFollowupGenerationPrompt,
  generateFollowupEmailContent,
  resolveFollowupProvider,
} from '@/lib/sales/followup/followupGenerator'
import { shouldSendFollowup } from '@/lib/sales/followup/followupDecisionEngine'
import { scheduleFollowup } from '@/lib/sales/followup/followupScheduler'
import { classifyGenerationFailure } from '@/lib/sales/generation/generationFailureClassifier'
import { scoreGeneratedEmail } from '@/lib/sales/quality/emailQualityScorer'
import {
  assertProviderRequestAllowed,
  recordProviderRequest,
} from '@/lib/sales/rate-limit/providerRateLimiter'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import {
  getSalesContactEngagement,
  incrementSalesContactFollowupCount,
} from '@/lib/sales/repositories/salesContactEngagementRepository'
import {
  approveSalesGeneratedEmail,
  createSalesGeneratedEmail,
  getNextSalesGeneratedEmailVersion,
  getSalesGeneratedEmailById,
} from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { createSalesGenerationLog } from '@/lib/sales/repositories/salesGenerationLogRepository'
import {
  claimSalesFollowupQueueItem,
  getSalesFollowupQueueById,
  markSalesFollowupQueueQueued,
  markSalesFollowupQueueSkipped,
} from '@/lib/sales/repositories/salesFollowupQueueRepository'
import { getSalesFollowupSequenceByCampaignId } from '@/lib/sales/repositories/salesFollowupSequenceRepository'
import { upsertSalesEmailQualityScore } from '@/lib/sales/repositories/salesEmailQualityRepository'
import { getSalesEmailSendQueueByGeneratedEmailId } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { queueApprovedEmail } from '@/lib/sales/sending/emailSendQueueService'

export type FollowupWorkerResult = {
  queueId: string
  outcome: 'queued' | 'skipped' | 'failed'
  generatedEmailId?: string
  generationProvider?: string
  errorMessage?: string
  skipReason?: string
}

function resolveThreadRootEmailId(source: {
  id: string
  thread_root_email_id: string | null
}): string {
  return source.thread_root_email_id ?? source.id
}

function resolveNextSequencePosition(source: { sequence_position: number }): number {
  return source.sequence_position + 1
}

export async function processScheduledFollowup(
  supabase: SupabaseClient,
  queueId: string,
): Promise<FollowupWorkerResult> {
  const existingBeforeClaim = await getSalesFollowupQueueById(supabase, queueId)
  if (!existingBeforeClaim) {
    return { queueId, outcome: 'failed', errorMessage: 'Follow-up queue item not found.' }
  }

  const claimed = await claimSalesFollowupQueueItem(supabase, queueId)
  if (!claimed) {
    return {
      queueId,
      outcome: 'skipped',
      skipReason: `Not claimable (status: ${existingBeforeClaim.status}).`,
    }
  }

  const [engagement, sequence, sourceEmail] = await Promise.all([
    getSalesContactEngagement(supabase, {
      contact_id: claimed.contact_id,
      campaign_id: claimed.campaign_id,
    }),
    getSalesFollowupSequenceByCampaignId(supabase, claimed.campaign_id),
    getSalesGeneratedEmailById(supabase, claimed.generated_email_id),
  ])

  const sentFollowupCount = engagement?.followup_count ?? 0

  const decision = shouldSendFollowup({
    engagement,
    sequence,
    followupNumber: claimed.followup_number,
    scheduledAt: claimed.scheduled_at,
    sentFollowupCount,
  })

  if (!decision.shouldSend) {
    await markSalesFollowupQueueSkipped(supabase, claimed.id)
    return { queueId: claimed.id, outcome: 'skipped', skipReason: decision.reason }
  }

  if (!sourceEmail) {
    await markSalesFollowupQueueSkipped(supabase, claimed.id)
    return {
      queueId: claimed.id,
      outcome: 'skipped',
      skipReason: 'Source generated email not found.',
    }
  }

  const campaign = await getSalesCampaignById(supabase, claimed.campaign_id)
  if (!campaign) {
    await markSalesFollowupQueueSkipped(supabase, claimed.id)
    return { queueId: claimed.id, outcome: 'skipped', skipReason: 'Campaign not found.' }
  }

  const contacts = await listSalesContactsByIds(supabase, [claimed.contact_id])
  const contact = contacts[0]
  if (!contact) {
    await markSalesFollowupQueueSkipped(supabase, claimed.id)
    return { queueId: claimed.id, outcome: 'skipped', skipReason: 'Contact not found.' }
  }

  const business = await getSalesBusinessById(supabase, contact.business_id)
  if (!business) {
    await markSalesFollowupQueueSkipped(supabase, claimed.id)
    return { queueId: claimed.id, outcome: 'skipped', skipReason: 'Business not found.' }
  }

  const provider = resolveFollowupProvider(sourceEmail.generation_provider)
  const threadRootEmailId = resolveThreadRootEmailId(sourceEmail)
  const sequencePosition = resolveNextSequencePosition(sourceEmail)

  const startedAt = Date.now()

  try {
    assertProviderRequestAllowed(provider)
    recordProviderRequest(provider)

    const { prompt } = await buildFollowupGenerationPrompt(supabase, {
      originalEmail: sourceEmail,
      campaign,
      contact,
      business,
      followupNumber: claimed.followup_number,
      provider,
      lastReplyAt: engagement?.last_reply_at ?? null,
    })

    const execution = await generateFollowupEmailContent({ provider, prompt })
    const resolvedProvider = execution.resolvedProvider

    const version = await getNextSalesGeneratedEmailVersion(supabase, {
      campaignId: campaign.id,
      contactId: contact.id,
    })

    const savedEmail = await createSalesGeneratedEmail(supabase, {
      campaign_id: campaign.id,
      contact_id: contact.id,
      subject: execution.content.subject,
      body: execution.content.body,
      generation_provider: resolvedProvider,
      status: 'draft',
      version,
      parent_generated_email_id: sourceEmail.id,
      thread_root_email_id: threadRootEmailId,
      sequence_position: sequencePosition,
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

    const reviewerId = campaign.created_by
    if (!reviewerId) {
      throw new Error('Campaign has no created_by user for autonomous follow-up approval.')
    }

    await approveSalesGeneratedEmail(supabase, savedEmail.id, reviewerId)

    const existingSendQueue = await getSalesEmailSendQueueByGeneratedEmailId(
      supabase,
      savedEmail.id,
    )
    if (!existingSendQueue || existingSendQueue.status === 'cancelled') {
      await queueApprovedEmail(supabase, savedEmail.id)
    }

    const queued = await markSalesFollowupQueueQueued(supabase, claimed.id, resolvedProvider)
    if (!queued) {
      return {
        queueId: claimed.id,
        outcome: 'failed',
        generatedEmailId: savedEmail.id,
        errorMessage: 'Follow-up could not be marked queued after send enqueue.',
      }
    }

    await incrementSalesContactFollowupCount(supabase, {
      contact_id: claimed.contact_id,
      campaign_id: claimed.campaign_id,
    })

    await scheduleFollowup(supabase, {
      generatedEmailId: savedEmail.id,
      contactId: claimed.contact_id,
      campaignId: claimed.campaign_id,
    })

    return {
      queueId: claimed.id,
      outcome: 'queued',
      generatedEmailId: savedEmail.id,
      generationProvider: resolvedProvider,
    }
  } catch (error) {
    const { status, failureReason } = classifyGenerationFailure(error)
    await createSalesGenerationLog(supabase, {
      generated_email_id: null,
      campaign_id: claimed.campaign_id,
      contact_id: claimed.contact_id,
      provider,
      latency_ms: Date.now() - startedAt,
      status,
      failure_reason: failureReason,
    })
    await markSalesFollowupQueueSkipped(supabase, claimed.id)
    return { queueId: claimed.id, outcome: 'failed', errorMessage: failureReason }
  }
}
