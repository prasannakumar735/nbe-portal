import type { SupabaseClient } from '@supabase/supabase-js'
import type { LLMProviderId } from '@/lib/sales/constants/llmProviders'
import { isLLMProviderId } from '@/lib/sales/constants/llmProviders'
import {
  processEmailGenerationForContact,
  type EmailGenerationWorkerResult,
} from '@/lib/sales/generation/emailGenerationWorker'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import {
  createSalesGenerationJob,
  failSalesGenerationJob,
  getSalesGenerationJobById,
  incrementSalesGenerationJobProgress,
  startSalesGenerationJob,
} from '@/lib/sales/repositories/salesGenerationJobRepository'
import { createSalesGenerationLog } from '@/lib/sales/repositories/salesGenerationLogRepository'
import { getLatestSalesGeneratedEmailForContact } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type { SalesCampaignContact } from '@/lib/sales/types/campaign.types'
import type { SalesGenerationJob } from '@/lib/sales/types/generationJob.types'

export type EmailGenerationBatchInput = {
  campaignId: string
  provider: string
  /** When false, only creates a queued batch job (workers run separately). Default true. */
  processImmediately?: boolean
  /** Resume existing batch (queue retries / duplicate worker safety). */
  existingGenerationJobId?: string
  /** Limit generation to these campaign contact ids (subset regen). */
  contactIds?: string[]
}

export type EmailGenerationBatchResult = {
  job: SalesGenerationJob
  audienceCount: number
  results: EmailGenerationWorkerResult[]
}

function mapCampaignContactRow(row: Record<string, unknown>): SalesCampaignContact {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    business_id: String(row.business_id),
    selected: Boolean(row.selected),
    created_at: String(row.created_at),
  }
}

async function listSelectedSalesCampaignContacts(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<SalesCampaignContact[]> {
  const { data, error } = await supabase
    .from('sales_campaign_contacts')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('selected', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => mapCampaignContactRow(row as Record<string, unknown>))
}

/**
 * Create batch job, load audience, and dispatch per-contact generation workers.
 */
export async function startEmailGenerationBatch(
  supabase: SupabaseClient,
  input: EmailGenerationBatchInput,
): Promise<EmailGenerationBatchResult> {
  if (!isLLMProviderId(input.provider)) {
    throw new Error(`Unknown LLM provider: ${input.provider}`)
  }
  const provider = input.provider as LLMProviderId

  const campaign = await getSalesCampaignById(supabase, input.campaignId)
  if (!campaign) {
    throw new Error('Campaign not found.')
  }

  let audience = await listSelectedSalesCampaignContacts(supabase, campaign.id)
  if (input.contactIds?.length) {
    const allowed = new Set(input.contactIds)
    audience = audience.filter((row) => allowed.has(row.contact_id))
  }
  if (audience.length === 0) {
    throw new Error('Campaign has no selected contacts for email generation.')
  }

  let job: SalesGenerationJob

  if (input.existingGenerationJobId) {
    const existing = await getSalesGenerationJobById(supabase, input.existingGenerationJobId)
    if (!existing || existing.campaign_id !== campaign.id) {
      throw new Error('Generation batch job not found for campaign.')
    }
    job = existing
  } else {
    job = await createSalesGenerationJob(supabase, {
      campaign_id: campaign.id,
      provider,
      total_contacts: audience.length,
      status: 'queued',
    })
  }

  const processImmediately = input.processImmediately !== false
  if (!processImmediately) {
    return { job, audienceCount: audience.length, results: [] }
  }

  const runningJob = await startSalesGenerationJob(supabase, job.id)
  if (!runningJob) {
    const refreshed = (await getSalesGenerationJobById(supabase, job.id)) ?? job
    if (refreshed.status === 'running') {
      job = refreshed
    } else if (
      refreshed.status === 'completed' ||
      refreshed.status === 'failed' ||
      refreshed.status === 'cancelled'
    ) {
      return { job: refreshed, audienceCount: audience.length, results: [] }
    } else {
      await failSalesGenerationJob(supabase, job.id)
      throw new Error('Failed to start generation batch job.')
    }
  }

  const activeJob =
    runningJob ?? (await getSalesGenerationJobById(supabase, job.id)) ?? job
  if (!activeJob || activeJob.status !== 'running') {
    return { job: activeJob ?? job, audienceCount: audience.length, results: [] }
  }

  const contactIds = [...new Set(audience.map((row) => row.contact_id))]
  const contacts = await listSalesContactsByIds(supabase, contactIds)
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  const results: EmailGenerationWorkerResult[] = []

  for (const row of audience) {
    const currentJob = await getSalesGenerationJobById(supabase, activeJob.id)
    if (!currentJob || currentJob.status === 'cancelled') {
      break
    }
    if (currentJob.status !== 'running') {
      break
    }

    const contact = contactById.get(row.contact_id)
    if (!contact) {
      results.push({
        contactId: row.contact_id,
        outcome: 'failed',
        errorMessage: 'Contact not found.',
      })
      await incrementFailedContactProgress(supabase, activeJob.id, campaign.id, row, provider)
      continue
    }

    if (!contact.email?.trim()) {
      results.push({
        contactId: contact.id,
        outcome: 'failed',
        errorMessage: 'Contact has no email address.',
      })
      await incrementFailedContactProgress(supabase, activeJob.id, campaign.id, row, provider)
      continue
    }

    const business = await getSalesBusinessById(supabase, row.business_id)
    if (!business) {
      results.push({
        contactId: contact.id,
        outcome: 'failed',
        errorMessage: 'Business not found.',
      })
      await incrementFailedContactProgress(supabase, activeJob.id, campaign.id, row, provider)
      continue
    }

    const result = await processEmailGenerationForContact(supabase, {
      job: currentJob,
      campaign,
      provider,
      contact,
      business,
    })
    results.push(result)
  }

  const finalJob = (await getSalesGenerationJobById(supabase, activeJob.id)) ?? activeJob

  return {
    job: finalJob,
    audienceCount: audience.length,
    results,
  }
}

async function incrementFailedContactProgress(
  supabase: SupabaseClient,
  jobId: string,
  campaignId: string,
  row: SalesCampaignContact,
  provider: LLMProviderId,
): Promise<void> {
  await createSalesGenerationLog(supabase, {
    generated_email_id: null,
    campaign_id: campaignId,
    contact_id: row.contact_id,
    provider,
    status: 'failed',
    failure_reason: 'Skipped contact during batch dispatch.',
  })
  await incrementSalesGenerationJobProgress(supabase, jobId, 'failed')
}

export type RegenerateEmailForContactInput = {
  campaignId: string
  contactId: string
  provider: string
}

export type RegenerateEmailForContactResult = EmailGenerationWorkerResult & {
  generationJob: SalesGenerationJob
}

/** Single-contact regeneration (new version row, parent link). */
export async function regenerateEmailForContact(
  supabase: SupabaseClient,
  input: RegenerateEmailForContactInput,
): Promise<RegenerateEmailForContactResult> {
  if (!isLLMProviderId(input.provider)) {
    throw new Error(`Unknown LLM provider: ${input.provider}`)
  }
  const provider = input.provider as LLMProviderId

  const campaign = await getSalesCampaignById(supabase, input.campaignId)
  if (!campaign) {
    throw new Error('Campaign not found.')
  }

  const audience = await listSelectedSalesCampaignContacts(supabase, campaign.id)
  const row = audience.find((r) => r.contact_id === input.contactId)
  if (!row) {
    throw new Error('Contact is not in the campaign audience.')
  }

  const contacts = await listSalesContactsByIds(supabase, [input.contactId])
  const contact = contacts[0]
  if (!contact) {
    throw new Error('Contact not found.')
  }
  if (!contact.email?.trim()) {
    throw new Error('Contact has no email address.')
  }

  const business = await getSalesBusinessById(supabase, row.business_id)
  if (!business) {
    throw new Error('Business not found.')
  }

  const prior = await getLatestSalesGeneratedEmailForContact(
    supabase,
    campaign.id,
    contact.id,
  )

  const job = await createSalesGenerationJob(supabase, {
    campaign_id: campaign.id,
    provider,
    total_contacts: 1,
    status: 'queued',
  })

  const runningJob = await startSalesGenerationJob(supabase, job.id)
  const activeJob =
    runningJob ?? (await getSalesGenerationJobById(supabase, job.id)) ?? job
  if (!activeJob || activeJob.status !== 'running') {
    await failSalesGenerationJob(supabase, job.id)
    throw new Error('Failed to start regeneration job.')
  }

  const result = await processEmailGenerationForContact(supabase, {
    job: activeJob,
    campaign,
    provider,
    contact,
    business,
    parentGeneratedEmailId: prior?.id ?? null,
  })

  const finalJob = (await getSalesGenerationJobById(supabase, activeJob.id)) ?? activeJob

  return {
    ...result,
    generationJob: finalJob,
  }
}
