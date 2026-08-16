/** Autonomous sales agents (Phase 15). */

export const SALES_CORE_AGENT_IDS = [
  'business_discovery',
  'contact_discovery',
  'prompt_resolution',
  'email_generation',
  'quality_review',
  'queue',
  'followup',
  'analytics',
] as const

export type SalesCoreAgentId = (typeof SALES_CORE_AGENT_IDS)[number]

/** Extended registry (assistant, legacy job agents). */
export const SALES_AGENT_IDS = [
  ...SALES_CORE_AGENT_IDS,
  'sales_assistant',
  'email_sending',
  'unsubscribe',
] as const

export type SalesAgentId = (typeof SALES_AGENT_IDS)[number]

export function resolveSalesAgentId(id: string): SalesAgentId | null {
  if ((SALES_AGENT_IDS as readonly string[]).includes(id)) return id as SalesAgentId
  if (id === 'email_sending') return 'queue'
  return null
}

export const SALES_AGENT_LABELS: Record<SalesCoreAgentId, string> = {
  business_discovery: 'Business Discovery',
  contact_discovery: 'Contact Discovery',
  prompt_resolution: 'Prompt Resolution',
  email_generation: 'Email Generation',
  quality_review: 'Quality Review',
  queue: 'Queue',
  followup: 'Follow-up',
  analytics: 'Analytics',
}
