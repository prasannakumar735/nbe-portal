import type { SalesAgentId } from '@/lib/sales/agents/agent.types'

export const UNSUBSCRIBE_AGENT_ID: SalesAgentId = 'unsubscribe'

/** Phase 4+: honor unsubscribe / suppression list before send agents run. */
export type UnsubscribeAgentInput = {
  email: string
}
