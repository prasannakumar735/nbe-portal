import {
  SALES_AGENT_LABELS,
  SALES_CORE_AGENT_IDS,
  type SalesCoreAgentId,
} from '@/lib/sales/agents/agent.types'
import type { SalesAgentDefinition } from '@/lib/sales/agents/runtime/agentRuntime.types'
import type { SalesJobType } from '@/lib/sales/jobs/job.types'

export const SALES_AGENT_REGISTRY: Record<SalesCoreAgentId, SalesAgentDefinition> = {
  business_discovery: {
    id: 'business_discovery',
    label: SALES_AGENT_LABELS.business_discovery,
    queueKind: 'sales_jobs',
    jobType: 'business_discovery',
    retryable: true,
    description: 'Google Places scan and business persistence per postcode job.',
  },
  contact_discovery: {
    id: 'contact_discovery',
    label: SALES_AGENT_LABELS.contact_discovery,
    queueKind: 'sales_jobs',
    jobType: 'contact_discovery',
    retryable: true,
    description: 'Website contact extraction per business job.',
  },
  prompt_resolution: {
    id: 'prompt_resolution',
    label: SALES_AGENT_LABELS.prompt_resolution,
    queueKind: 'sales_jobs',
    jobType: 'prompt_resolution',
    retryable: true,
    description: 'Resolve Prompt Library bundle for campaign contact without LLM generation.',
  },
  email_generation: {
    id: 'email_generation',
    label: SALES_AGENT_LABELS.email_generation,
    queueKind: 'sales_jobs',
    jobType: 'email_generation',
    retryable: true,
    description: 'Batch AI draft generation via sales_generation_jobs.',
  },
  quality_review: {
    id: 'quality_review',
    label: SALES_AGENT_LABELS.quality_review,
    queueKind: 'sales_jobs',
    jobType: 'quality_review',
    retryable: true,
    description: 'Score a generated email (same scorer as inline generation path).',
  },
  queue: {
    id: 'queue',
    label: SALES_AGENT_LABELS.queue,
    queueKind: 'email_send_queue',
    retryable: true,
    description: 'Microsoft Graph send queue dispatch (manager-approved emails only).',
  },
  followup: {
    id: 'followup',
    label: SALES_AGENT_LABELS.followup,
    queueKind: 'followup_queue',
    retryable: true,
    description: 'AI follow-up draft generation for due scheduled rows.',
  },
  analytics: {
    id: 'analytics',
    label: SALES_AGENT_LABELS.analytics,
    queueKind: 'sales_jobs',
    jobType: 'analytics',
    retryable: true,
    description: 'Read-only analytics snapshot job (optional prompt metrics persist).',
  },
}

export function getSalesAgentDefinition(agentId: SalesCoreAgentId): SalesAgentDefinition {
  return SALES_AGENT_REGISTRY[agentId]
}

export function jobTypeForAgent(agentId: SalesCoreAgentId): SalesJobType | undefined {
  return SALES_AGENT_REGISTRY[agentId].jobType
}

export function listSalesAgentDefinitions(): SalesAgentDefinition[] {
  return SALES_CORE_AGENT_IDS.map((id) => SALES_AGENT_REGISTRY[id])
}

export function resolveCoreAgentId(raw: string): SalesCoreAgentId | null {
  if (raw === 'email_sending') return 'queue'
  if ((SALES_CORE_AGENT_IDS as readonly string[]).includes(raw)) {
    return raw as SalesCoreAgentId
  }
  return null
}
