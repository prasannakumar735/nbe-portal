import { z } from 'zod'
import { LLM_PROVIDER_IDS } from '@/lib/sales/constants/llmProviders'
import { SALES_GENERATION_LOG_STATUSES } from '@/lib/sales/constants/generationLogStatuses'

export const salesGenerationLogListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  provider: z.enum(LLM_PROVIDER_IDS).optional(),
  status: z.enum(SALES_GENERATION_LOG_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const createSalesGenerationLogBodySchema = z.object({
  generatedEmailId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
  provider: z.enum(LLM_PROVIDER_IDS),
  promptTokens: z.number().int().min(0).optional(),
  completionTokens: z.number().int().min(0).optional(),
  estimatedCost: z.number().min(0).optional(),
  latencyMs: z.number().int().min(0).optional(),
  status: z.enum(SALES_GENERATION_LOG_STATUSES).optional(),
  failureReason: z.string().trim().max(2000).nullable().optional(),
})
