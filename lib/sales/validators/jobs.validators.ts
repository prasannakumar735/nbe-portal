import { z } from 'zod'

export const processSalesJobsBodySchema = z.object({
  jobIds: z.array(z.string().uuid()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  retryFailed: z.boolean().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
})
