import { z } from 'zod'
import { SALES_PIPELINE_STAGES } from '@/lib/sales/constants/pipelineStages'

const moneyCents = z.number().int().min(0).max(999_999_999_99)
const probability = z.number().int().min(0).max(100)

export const salesPipelineStageSchema = z.enum(SALES_PIPELINE_STAGES)

export const salesPipelineOpportunityListQuerySchema = z.object({
  stage: salesPipelineStageSchema.optional(),
  ownerUserId: z.string().uuid().optional(),
  openOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const createSalesPipelineOpportunityBodySchema = z.object({
  businessId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200).optional(),
  stage: salesPipelineStageSchema.optional(),
  revenueCents: moneyCents.optional(),
  probabilityPercent: probability.optional(),
  inspectionValueCents: moneyCents.optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(20_000).optional(),
})

export const updateSalesPipelineOpportunityBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  stage: salesPipelineStageSchema.optional(),
  contactId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  revenueCents: moneyCents.optional(),
  probabilityPercent: probability.optional(),
  inspectionValueCents: moneyCents.optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(20_000).optional(),
})

export const salesPipelineOpportunityIdParamSchema = z.object({
  opportunityId: z.string().uuid(),
})
