import { z } from 'zod'
import {
  LLM_PROVIDER_IDS,
  resolveDefaultSalesLlmProvider,
} from '@/lib/sales/constants/llmProviders'
import { PVC_DISCOVERY_CATEGORIES } from '@/lib/sales/constants/discoveryCategories'
import type {
  BusinessDiscoveryJobPayload,
  EmailGenerationJobPayload,
} from '@/lib/sales/jobs/job.types'

export const businessDiscoveryJobPayloadSchema = z.object({
  postcode: z.string().trim().regex(/^\d{4}$/),
  categories: z.array(z.string().trim().min(1)).min(1),
  created_by: z.string().uuid(),
  refresh_from_google: z.boolean().optional(),
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
  provider: z.preprocess(
    (value) =>
      value === undefined || value === null || value === ''
        ? resolveDefaultSalesLlmProvider()
        : value,
    z.enum(LLM_PROVIDER_IDS),
  ),
  created_by: z.string().uuid(),
  generation_job_id: z.string().uuid().optional(),
})

export function parseEmailGenerationJobPayload(
  raw: Record<string, unknown>,
): EmailGenerationJobPayload {
  return emailGenerationJobPayloadSchema.parse(raw)
}

export const promptResolutionJobPayloadSchema = z.object({
  campaign_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  business_id: z.string().uuid(),
  use_case_slug: z.string().trim().optional(),
  created_by: z.string().uuid(),
})

export function parsePromptResolutionJobPayload(
  raw: Record<string, unknown>,
): import('@/lib/sales/jobs/job.types').PromptResolutionJobPayload {
  return promptResolutionJobPayloadSchema.parse(raw)
}

export const qualityReviewJobPayloadSchema = z.object({
  generated_email_id: z.string().uuid(),
  created_by: z.string().uuid(),
})

export function parseQualityReviewJobPayload(
  raw: Record<string, unknown>,
): import('@/lib/sales/jobs/job.types').QualityReviewJobPayload {
  return qualityReviewJobPayloadSchema.parse(raw)
}

export const analyticsJobPayloadSchema = z.object({
  created_by: z.string().uuid(),
  persist_prompt_metrics: z.boolean().optional(),
})

export function parseAnalyticsJobPayload(
  raw: Record<string, unknown>,
): import('@/lib/sales/jobs/job.types').AnalyticsJobPayload {
  return analyticsJobPayloadSchema.parse(raw)
}
