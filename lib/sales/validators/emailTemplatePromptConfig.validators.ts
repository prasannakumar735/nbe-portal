import { z } from 'zod'
import { SALES_EMAIL_TEMPLATE_TONES } from '@/lib/sales/constants/emailTemplate.constants'

export const salesEmailTemplatePromptConfigSchema = z.object({
  objective: z.string().trim().min(1).max(2000),
  pain_points: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  cta: z.string().trim().min(1).max(500),
  tone: z.enum(SALES_EMAIL_TEMPLATE_TONES),
  target_roles: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
  avoid: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
})

export type SalesEmailTemplatePromptConfigInput = z.infer<
  typeof salesEmailTemplatePromptConfigSchema
>
