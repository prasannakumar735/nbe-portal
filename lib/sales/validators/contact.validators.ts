import { z } from 'zod'

export const contactDiscoveryRequestSchema = z.object({
  businessIds: z.array(z.string().uuid()).min(1).max(50),
  processImmediately: z.boolean().optional(),
})
