import { z } from 'zod'
import { SALES_FOLLOWUP_QUEUE_STATUSES } from '@/lib/sales/constants/followupQueueStatuses'

export const upsertSalesFollowupSequenceBodySchema = z.object({
  campaignId: z.string().uuid(),
  enabled: z.boolean().optional(),
  maxFollowups: z.number().int().min(0).max(20).optional(),
  followupDelayDays: z.number().int().min(0).max(90).optional(),
  stopOnReply: z.boolean().optional(),
})

export const salesFollowupSequenceQuerySchema = z.object({
  campaignId: z.string().uuid(),
})

export const salesFollowupQueueListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: z.enum(SALES_FOLLOWUP_QUEUE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const dispatchSalesFollowupQueueBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  queueIds: z.array(z.string().uuid()).optional(),
})

export const salesContactEngagementPatchBodySchema = z.object({
  contactId: z.string().uuid(),
  campaignId: z.string().uuid(),
  replyDetected: z.boolean().optional(),
  opened: z.boolean().optional(),
  clicked: z.boolean().optional(),
  unsubscribed: z.boolean().optional(),
  bounceDetected: z.boolean().optional(),
})

export const scheduleSalesFollowupBodySchema = z.object({
  generatedEmailId: z.string().uuid(),
  contactId: z.string().uuid(),
  campaignId: z.string().uuid(),
})
