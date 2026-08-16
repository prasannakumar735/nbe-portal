import { z } from 'zod'
import { SALES_INDUSTRY_SLUGS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_SLUGS } from '@/lib/sales/constants/productLineSlugs'
import { SALES_PROMPT_USE_CASE_SLUGS } from '@/lib/sales/constants/useCaseSlugs'

export const salesAiPromptDefinitionSchema = z.object({
  system_prompt_extension: z.string().trim().max(4000).optional(),
  writing_style: z.string().trim().min(1).max(500),
  tone: z.string().trim().min(1).max(200),
  target_audience: z.array(z.string().trim().min(1).max(300)).max(20),
  business_pain_points: z.array(z.string().trim().min(1).max(500)).max(30),
  value_proposition: z.string().trim().min(1).max(2000),
  cta: z.string().trim().min(1).max(500),
  subject_line_guidance: z.string().trim().min(1).max(1000),
  word_limit: z.number().int().min(50).max(500),
  avoid: z.array(z.string().trim().min(1).max(200)).max(20),
  user_prompt_template: z.string().trim().max(12000).optional(),
})

export const createSalesAiPromptBodySchema = z.object({
  productSlug: z.enum(SALES_PRODUCT_LINE_SLUGS),
  industrySlug: z.enum(SALES_INDUSTRY_SLUGS),
  useCaseSlug: z.enum(SALES_PROMPT_USE_CASE_SLUGS),
  campaignTypeId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  definition: salesAiPromptDefinitionSchema,
  activate: z.boolean().optional(),
  confirmReplace: z.boolean().optional(),
})

export const updateSalesAiPromptBodySchema = z
  .object({
    definition: salesAiPromptDefinitionSchema.optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.definition != null || v.description !== undefined, {
    message: 'Provide definition and/or description.',
  })

export const salesAiPromptListQuerySchema = z.object({
  productSlug: z.enum(SALES_PRODUCT_LINE_SLUGS).optional(),
  industrySlug: z.enum(SALES_INDUSTRY_SLUGS).optional(),
  useCaseSlug: z.enum(SALES_PROMPT_USE_CASE_SLUGS).optional(),
  campaignTypeId: z.string().uuid().optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  promptName: z.string().trim().min(1).max(200).optional(),
})

export const salesAiPromptPreviewQuerySchema = z.object({
  promptId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  campaignTypeId: z.string().uuid().optional(),
  productSlug: z.enum(SALES_PRODUCT_LINE_SLUGS).optional(),
  industrySlug: z.enum(SALES_INDUSTRY_SLUGS).optional(),
  useCaseSlug: z.enum(SALES_PROMPT_USE_CASE_SLUGS).optional(),
  contactId: z.string().uuid().optional(),
  businessCategory: z.string().trim().max(500).optional(),
})

export const salesAiPromptIdParamSchema = z.object({
  id: z.string().uuid(),
})
