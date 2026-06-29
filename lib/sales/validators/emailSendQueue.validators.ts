import { z } from 'zod'
import { EMAIL_SEND_PROVIDER_IDS } from '@/lib/sales/constants/emailSendProviders'
import { SALES_EMAIL_SEND_QUEUE_STATUSES } from '@/lib/sales/constants/emailSendQueueStatuses'

export const queueApprovedEmailBodySchema = z.object({
  generatedEmailId: z.string().uuid(),
  provider: z.enum(EMAIL_SEND_PROVIDER_IDS).optional(),
  scheduledAt: z.string().datetime().optional(),
})

export const bulkQueueApprovedEmailsBodySchema = z.object({
  generatedEmailIds: z.array(z.string().uuid()).min(1).max(200),
  provider: z.enum(EMAIL_SEND_PROVIDER_IDS).optional(),
  scheduledAt: z.string().datetime().optional(),
})

export const cancelQueuedEmailParamSchema = z.object({
  queueId: z.string().uuid(),
})

export const emailSendQueueListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  status: z.enum(SALES_EMAIL_SEND_QUEUE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const dispatchEmailSendQueueBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  queueIds: z.array(z.string().uuid()).optional(),
})
