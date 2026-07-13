import { z } from 'zod'
import { SALES_CORE_AGENT_IDS } from '@/lib/sales/agents/agent.types'

const agentIdSchema = z.union([
  z.enum(SALES_CORE_AGENT_IDS),
  z.literal('email_sending'),
])

export const dispatchSalesAgentBodySchema = z.object({
  agentId: agentIdSchema,
  limit: z.coerce.number().int().min(1).max(50).optional(),
  jobIds: z.array(z.string().uuid()).optional(),
  queueIds: z.array(z.string().uuid()).optional(),
  retryFailed: z.boolean().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
})
