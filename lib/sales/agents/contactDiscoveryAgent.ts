import type { SupabaseClient } from '@supabase/supabase-js'
import { CONTACT_DISCOVERY_AGENT_ID } from '@/lib/sales/agents/contactDiscoveryAgent.constants'
import type { ContactDiscoveryJobResult } from '@/lib/sales/agents/contactDiscoveryExecutor'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import type { SalesJob, SalesJobProcessResult } from '@/lib/sales/jobs/job.types'
import { createSalesJobs, listSalesJobsByIds } from '@/lib/sales/jobs/salesJobRepository'
import type { ContactDiscoveryAgentResult } from '@/lib/sales/types/contact.types'

export type ContactDiscoveryAgentInput = {
  businessIds: string[]
  createdBy: string
  processImmediately?: boolean
}

export type ContactDiscoveryEnqueueResult = {
  jobs: SalesJob[]
}

/**
 * Enqueue one contact_discovery job per business (no direct provider/repository calls).
 */
export async function enqueueContactDiscovery(
  supabase: SupabaseClient,
  input: ContactDiscoveryAgentInput,
): Promise<ContactDiscoveryEnqueueResult> {
  const uniqueIds = [...new Set(input.businessIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) {
    throw new Error('At least one business id is required.')
  }
  if (uniqueIds.length > 50) {
    throw new Error('Maximum 50 businesses per contact discovery request.')
  }

  const jobs = await createSalesJobs(
    supabase,
    uniqueIds.map((business_id) => ({
      job_type: 'contact_discovery',
      payload: {
        business_id,
        created_by: input.createdBy,
      },
    })),
  )
  return { jobs }
}

function summarizeResults(processResults: SalesJobProcessResult[]): ContactDiscoveryJobResult[] {
  return processResults
    .map((pr) => pr.result as ContactDiscoveryJobResult | undefined)
    .filter((r): r is ContactDiscoveryJobResult => r != null)
}

/**
 * Enqueue and optionally process contact discovery via sales_jobs.
 * Website scan audit rows (sales_contact_scan_logs) are written in executeContactDiscoveryJob.
 */
export async function runContactDiscoveryAgent(
  supabase: SupabaseClient,
  input: ContactDiscoveryAgentInput,
): Promise<ContactDiscoveryAgentResult> {
  const { jobs } = await enqueueContactDiscovery(supabase, input)
  const processImmediately = input.processImmediately !== false

  let processResults: SalesJobProcessResult[] = []
  if (processImmediately && jobs.length > 0) {
    processResults = await processSalesJobs(supabase, {
      jobIds: jobs.map((j) => j.id),
      limit: jobs.length,
    })
  }

  const refreshedJobs = processImmediately
    ? await listSalesJobsByIds(
        supabase,
        jobs.map((j) => j.id),
      )
    : jobs

  return {
    jobs: refreshedJobs,
    results: summarizeResults(processResults),
  }
}

export { CONTACT_DISCOVERY_AGENT_ID }
