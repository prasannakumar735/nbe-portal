import { z } from 'zod'
import { LLM_PROVIDER_IDS } from '@/lib/sales/constants/llmProviders'
import { SALES_GENERATED_EMAIL_STATUSES } from '@/lib/sales/constants/generatedEmailStatuses'

export const salesGeneratedEmailListQuerySchema = z.object({
  campaignId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  status: z.enum(SALES_GENERATED_EMAIL_STATUSES).optional(),
})

export const createSalesGeneratedEmailBodySchema = z.object({
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50000),
  generationProvider: z.enum(LLM_PROVIDER_IDS),
  status: z.enum(SALES_GENERATED_EMAIL_STATUSES).optional(),
  version: z.number().int().min(1).optional(),
  sequencePosition: z.number().int().min(0).max(20).optional(),
})

export const updateSalesGeneratedEmailBodySchema = z.object({
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).max(50000).optional(),
  status: z.enum(SALES_GENERATED_EMAIL_STATUSES).optional(),
})
