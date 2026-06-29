import type { SalesAgentId } from '@/lib/sales/agents/agent.types'

export const EMAIL_GENERATION_AGENT_ID: SalesAgentId = 'email_generation'

/** Phase 3+: draft personalized outreach from business + contact context. */
export type EmailGenerationAgentInput = {
  businessIds: string[]
}
