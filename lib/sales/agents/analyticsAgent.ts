import type { SalesAgentId } from '@/lib/sales/agents/agent.types'

export const ANALYTICS_AGENT_ID: SalesAgentId = 'analytics'

/** Phase 5+: funnel metrics across scan runs, contacts, replies, unsubscribes. */
export type AnalyticsAgentInput = {
  fromDate?: string
  toDate?: string
}
