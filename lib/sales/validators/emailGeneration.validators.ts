import { z } from 'zod'
import { LLM_PROVIDER_IDS, resolveDefaultSalesLlmProvider } from '@/lib/sales/constants/llmProviders'

export const emailGenerationRequestSchema = z.object({
  provider: z.preprocess(
    (value) =>
      value === undefined || value === null || value === ''
        ? resolveDefaultSalesLlmProvider()
        : value,
    z.enum(LLM_PROVIDER_IDS),
  ).optional(),
  processImmediately: z.boolean().optional(),
  contactIds: z.array(z.string().uuid()).min(1).max(200).optional(),
})

export const campaignIdParamSchema = z.object({
  campaignId: z.string().uuid(),
})

export const campaignContactParamSchema = z.object({
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
})

export const regenerateEmailBodySchema = z.object({
  provider: z.preprocess(
    (value) =>
      value === undefined || value === null || value === ''
        ? resolveDefaultSalesLlmProvider()
        : value,
    z.enum(LLM_PROVIDER_IDS),
  ).optional(),
})
