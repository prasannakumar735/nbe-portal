import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_EMAIL_SEND_PROVIDER,
  type EmailSendQueueOptions,
} from '@/lib/sales/sending/emailSendQueue.constants'
import {
  createSalesEmailSendQueueItem,
  cancelSalesEmailSendQueueItem,
  getSalesEmailSendQueueByGeneratedEmailId,
  reactivateCancelledSalesEmailSendQueueItem,
  SalesEmailSendQueueError,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import {
  getSalesGeneratedEmailById,
  markSalesGeneratedEmailQueued,
} from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { advanceSalesCampaignStatus } from '@/lib/sales/repositories/salesCampaignRepository'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'

export type BulkQueueApprovedEmailsResult = {
  succeeded: SalesEmailSendQueue[]
  failed: { generatedEmailId: string; reason: string }[]
}

export async function queueApprovedEmail(
  supabase: SupabaseClient,
  generatedEmailId: string,
  options?: EmailSendQueueOptions,
): Promise<SalesEmailSendQueue> {
  const email = await getSalesGeneratedEmailById(supabase, generatedEmailId)
  if (!email) {
    throw new SalesEmailSendQueueError('Generated email not found.')
  }
  if (email.status !== 'approved' && email.status !== 'queued') {
    throw new SalesEmailSendQueueError('Only approved emails can be queued for sending.')
  }

  const existingQueue = await getSalesEmailSendQueueByGeneratedEmailId(supabase, generatedEmailId)
  if (existingQueue && existingQueue.status !== 'cancelled') {
    throw new SalesEmailSendQueueError('A send queue record already exists for this email.')
  }

  if (email.status === 'approved') {
    await markSalesGeneratedEmailQueued(supabase, generatedEmailId)
  }

  const provider = options?.provider ?? DEFAULT_EMAIL_SEND_PROVIDER
  const scheduledAt = options?.scheduledAt

  if (existingQueue?.status === 'cancelled') {
    const reactivated = await reactivateCancelledSalesEmailSendQueueItem(
      supabase,
      existingQueue.id,
      { provider, scheduledAt },
    )
    if (!reactivated) {
      throw new SalesEmailSendQueueError('Failed to re-queue cancelled send item.')
    }
    return reactivated
  }

  return createSalesEmailSendQueueItem(supabase, {
    generated_email_id: generatedEmailId,
    campaign_id: email.campaign_id,
    contact_id: email.contact_id,
    provider,
    scheduled_at: scheduledAt,
  })
}

export async function bulkQueueApprovedEmails(
  supabase: SupabaseClient,
  generatedEmailIds: string[],
  options?: EmailSendQueueOptions,
): Promise<BulkQueueApprovedEmailsResult> {
  const succeeded: SalesEmailSendQueue[] = []
  const failed: { generatedEmailId: string; reason: string }[] = []

  for (const generatedEmailId of generatedEmailIds) {
    try {
      succeeded.push(await queueApprovedEmail(supabase, generatedEmailId, options))
    } catch (error) {
      failed.push({
        generatedEmailId,
        reason: error instanceof Error ? error.message : 'Queue failed.',
      })
    }
  }

  // Advance campaign from draft → ready when at least one email was queued.
  // Uses a conditional update so concurrent calls are idempotent.
  if (succeeded.length > 0) {
    const campaignId = succeeded[0].campaign_id
    await advanceSalesCampaignStatus(supabase, campaignId, 'draft', 'ready').catch(() => {
      // Non-fatal: status may already be ready/sending/completed from a prior queue action.
    })
  }

  return { succeeded, failed }
}

export async function cancelQueuedEmail(
  supabase: SupabaseClient,
  queueId: string,
): Promise<SalesEmailSendQueue | null> {
  return cancelSalesEmailSendQueueItem(supabase, queueId)
}
