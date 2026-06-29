/** Sales Engine agent registry (orchestrators under lib/sales/agents). */
export const SALES_AGENT_IDS = [
  'business_discovery',
  'contact_discovery',
  'email_generation',
  'email_sending',
  'followup',
  'unsubscribe',
  'analytics',
] as const

export type SalesAgentId = (typeof SALES_AGENT_IDS)[number]
