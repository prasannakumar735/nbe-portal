import { z } from 'zod'

export const generatedEmailReviewIdParamSchema = z.object({
  emailId: z.string().uuid(),
})

export const editGeneratedEmailReviewBodySchema = z.object({
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50000),
})

export const bulkGeneratedEmailReviewBodySchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1).max(200),
})

export const generatedEmailReviewListQuerySchema = z.object({
  campaignId: z.string().uuid(),
  status: z
    .enum(['draft', 'approved', 'edited', 'rejected', 'queued', 'sent'])
    .optional(),
})
