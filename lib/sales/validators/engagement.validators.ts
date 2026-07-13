import { z } from 'zod'
import { SALES_ENGAGEMENT_EVENT_SOURCES, SALES_ENGAGEMENT_EVENT_TYPES } from '@/lib/sales/constants/engagementEventTypes'

export const recordEngagementEventBodySchema = z.object({
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
  eventType: z.enum(SALES_ENGAGEMENT_EVENT_TYPES),
  source: z.enum(SALES_ENGAGEMENT_EVENT_SOURCES).optional(),
  generatedEmailId: z.string().uuid().optional(),
  queueId: z.string().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
})

export const engagementTrackingClickQuerySchema = z.object({
  url: z.string().url(),
})

export const promptEngagementMetricsQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  persist: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})
