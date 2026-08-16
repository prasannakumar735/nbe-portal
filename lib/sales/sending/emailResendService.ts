import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSalesEmailSendQueueById,
  prepareManualResendSalesEmailSendQueueItem,
  SalesEmailSendQueueError,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'

export class EmailResendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailResendError'
  }
}

/** Manual resend for failed/cancelled queue items. Does not bypass approval. */
export async function resendEmailSendQueueItem(
  supabase: SupabaseClient,
  queueId: string,
): Promise<SalesEmailSendQueue> {
  const existing = await getSalesEmailSendQueueById(supabase, queueId)
  if (!existing) {
    throw new EmailResendError('Send queue item not found.')
  }
  if (existing.status !== 'failed' && existing.status !== 'cancelled') {
    throw new EmailResendError('Only failed or cancelled items can be resent.')
  }

  const email = await getSalesGeneratedEmailById(supabase, existing.generated_email_id)
  if (!email) {
    throw new EmailResendError('Generated email not found.')
  }
  if (email.status === 'sent') {
    throw new EmailResendError('This email was already sent.')
  }
  if (email.status !== 'queued' && email.status !== 'approved') {
    throw new EmailResendError('Generated email must remain approved or queued to resend.')
  }

  const requeued = await prepareManualResendSalesEmailSendQueueItem(supabase, queueId)
  if (!requeued) {
    throw new SalesEmailSendQueueError('Could not re-queue item for resend.')
  }
  return requeued
}
