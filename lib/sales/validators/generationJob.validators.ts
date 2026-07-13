import { z } from 'zod'
import {
  LLM_PROVIDER_IDS,
  resolveDefaultSalesLlmProvider,
} from '@/lib/sales/constants/llmProviders'
import { SALES_GENERATION_JOB_STATUSES } from '@/lib/sales/constants/generationJobStatuses'

export const salesGenerationJobListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  status: z.enum(SALES_GENERATION_JOB_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export const createSalesGenerationJobBodySchema = z.object({
  campaignId: z.string().uuid(),
  provider: z.preprocess(
    (value) =>
      value === undefined || value === null || value === ''
        ? resolveDefaultSalesLlmProvider()
        : value,
    z.enum(LLM_PROVIDER_IDS),
  ),
  totalContacts: z.number().int().min(0),
  status: z.enum(SALES_GENERATION_JOB_STATUSES).optional(),
})

export const updateSalesGenerationJobBodySchema = z.object({
  processedCount: z.number().int().min(0).optional(),
  successCount: z.number().int().min(0).optional(),
  failedCount: z.number().int().min(0).optional(),
  status: z.enum(SALES_GENERATION_JOB_STATUSES).optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
})
