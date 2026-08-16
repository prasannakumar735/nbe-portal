import type { SalesAgentId } from '@/lib/sales/agents/agent.types'

export const QUEUE_AGENT_ID: SalesAgentId = 'queue'

/** @deprecated Use QUEUE_AGENT_ID */
export const EMAIL_SENDING_AGENT_ID: SalesAgentId = 'email_sending'

/** Phase 3+: send approved drafts; updates last_contacted_at and contact_attempts. */
export type EmailSendingAgentInput = {
  businessIds: string[]
}
