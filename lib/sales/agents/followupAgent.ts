import type { SalesAgentId } from '@/lib/sales/agents/agent.types'

export const FOLLOWUP_AGENT_ID: SalesAgentId = 'followup'

/** Phase 4+: scheduled follow-up sequences for non-responders. */
export type FollowupAgentInput = {
  businessIds: string[]
}
