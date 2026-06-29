import { z } from 'zod'
import { LLM_PROVIDER_IDS } from '@/lib/sales/constants/llmProviders'
import { PVC_DISCOVERY_CATEGORIES } from '@/lib/sales/constants/discoveryCategories'
import type {
  BusinessDiscoveryJobPayload,
  EmailGenerationJobPayload,
} from '@/lib/sales/jobs/job.types'

export const businessDiscoveryJobPayloadSchema = z.object({
  postcode: z.string().trim().regex(/^\d{4}$/),
  categories: z.array(z.string().trim().min(1)).min(1),
  created_by: z.string().uuid(),
})

export function parseBusinessDiscoveryJobPayload(
  raw: Record<string, unknown>,
): BusinessDiscoveryJobPayload {
  return businessDiscoveryJobPayloadSchema.parse(raw)
}

export function defaultDiscoveryCategories(): string[] {
  return [...PVC_DISCOVERY_CATEGORIES]
}

export const contactDiscoveryJobPayloadSchema = z.object({
  business_id: z.string().uuid(),
  created_by: z.string().uuid(),
})

export function parseContactDiscoveryJobPayload(
  raw: Record<string, unknown>,
): import('@/lib/sales/jobs/job.types').ContactDiscoveryJobPayload {
  return contactDiscoveryJobPayloadSchema.parse(raw)
}

export const emailGenerationJobPayloadSchema = z.object({
  campaign_id: z.string().uuid(),
  provider: z.enum(LLM_PROVIDER_IDS),
  created_by: z.string().uuid(),
  generation_job_id: z.string().uuid().optional(),
})

export function parseEmailGenerationJobPayload(
  raw: Record<string, unknown>,
): EmailGenerationJobPayload {
  return emailGenerationJobPayloadSchema.parse(raw)
}
