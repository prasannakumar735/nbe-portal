import { z } from 'zod'
import { salesEmailTemplatePromptConfigSchema } from '@/lib/sales/validators/emailTemplatePromptConfig.validators'

export const salesEmailTemplateListQuerySchema = z.object({
  campaignTypeId: z.string().uuid().optional(),
})

export const createSalesEmailTemplateBodySchema = z.object({
  campaignTypeId: z.string().uuid(),
  templateName: z.string().trim().min(1).max(200),
  promptConfig: salesEmailTemplatePromptConfigSchema,
  isActive: z.boolean().optional(),
})

export const updateSalesEmailTemplateBodySchema = z.object({
  campaignTypeId: z.string().uuid().optional(),
  templateName: z.string().trim().min(1).max(200).optional(),
  promptConfig: salesEmailTemplatePromptConfigSchema.optional(),
  isActive: z.boolean().optional(),
})

export const activateSalesEmailTemplateBodySchema = z.object({
  isActive: z.boolean(),
})
