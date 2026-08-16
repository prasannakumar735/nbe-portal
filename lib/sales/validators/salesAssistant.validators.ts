import { z } from 'zod'
import { SALES_ASSISTANT_CAPABILITIES } from '@/lib/sales/constants/assistantCapabilities'
import { LLM_PROVIDER_IDS } from '@/lib/sales/constants/llmProviders'

export const salesAssistantCapabilitySchema = z.enum(SALES_ASSISTANT_CAPABILITIES)

export const runSalesAssistantBodySchema = z.object({
  capability: salesAssistantCapabilitySchema,
  businessId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  replyText: z.string().max(50_000).optional().nullable(),
  managerNotes: z.string().max(20_000).optional().nullable(),
  provider: z.enum(LLM_PROVIDER_IDS).optional().nullable(),
})

export const appendAssistantNotesBodySchema = z.object({
  opportunityId: z.string().uuid(),
  text: z.string().trim().min(1).max(20_000),
})
