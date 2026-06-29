import type { SupabaseClient } from '@supabase/supabase-js'
import { BUSINESS_DISCOVERY_AGENT_ID } from '@/lib/sales/agents/businessDiscoveryAgent.constants'
import type { BusinessDiscoveryJobResult } from '@/lib/sales/agents/businessDiscoveryExecutor'
import { PVC_DISCOVERY_CATEGORIES } from '@/lib/sales/constants/discoveryCategories'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import type { SalesJob, SalesJobProcessResult } from '@/lib/sales/jobs/job.types'
import { createSalesJobs, listSalesJobsByIds } from '@/lib/sales/jobs/salesJobRepository'
import { listSalesBusinessesByPostcodes } from '@/lib/sales/repositories/salesBusinessRepository'
import { listSalesScanRunsByIds } from '@/lib/sales/repositories/salesScanRunRepository'
import type { BusinessDiscoveryAgentResult } from '@/lib/sales/types/business.types'

export type BusinessDiscoveryAgentInput = {
  postcodes: string[]
  createdBy: string
  categories?: string[]
  /** When true (default), pending jobs are processed in-process after enqueue. */
  processImmediately?: boolean
}

export type BusinessDiscoveryEnqueueResult = {
  jobs: SalesJob[]
}

/**
 * Enqueue one `business_discovery` job per postcode (no direct provider/repository calls).
 */
export async function enqueueBusinessDiscoveryScan(
  supabase: SupabaseClient,
  input: BusinessDiscoveryAgentInput,
): Promise<BusinessDiscoveryEnqueueResult> {
  const categories = input.categories ?? [...PVC_DISCOVERY_CATEGORIES]
  const jobs = await createSalesJobs(
    supabase,
    input.postcodes.map((postcode) => ({
      job_type: 'business_discovery',
      payload: {
        postcode,
        categories,
        created_by: input.createdBy,
      },
    })),
  )
  return { jobs }
}

function summarizeProcessResults(processResults: SalesJobProcessResult[]) {
  let inserted = 0
  let skipped = 0
  const scanRunIds: string[] = []
  for (const r of processResults) {
    const result = r.result as BusinessDiscoveryJobResult | undefined
    if (!result) continue
    inserted += result.inserted
    skipped += result.skipped
    scanRunIds.push(result.scan_run_id)
  }
  return { inserted, skipped, scanRunIds }
}

/**
 * Request scan: enqueue jobs, optionally process via job queue, return summary for API.
 */
export async function runBusinessDiscoveryAgent(
  supabase: SupabaseClient,
  input: BusinessDiscoveryAgentInput,
): Promise<BusinessDiscoveryAgentResult & { jobs: SalesJob[] }> {
  const { jobs } = await enqueueBusinessDiscoveryScan(supabase, input)
  const processImmediately = input.processImmediately !== false

  let processResults: SalesJobProcessResult[] = []
  if (processImmediately && jobs.length > 0) {
    processResults = await processSalesJobs(supabase, {
      jobIds: jobs.map((j) => j.id),
      limit: jobs.length,
    })
  }

  const { inserted, skipped, scanRunIds } = summarizeProcessResults(processResults)
  const refreshedJobs = processImmediately
    ? await listSalesJobsByIds(
        supabase,
        jobs.map((j) => j.id),
      )
    : jobs

  const scan_runs = processImmediately ? await listSalesScanRunsByIds(supabase, scanRunIds) : []
  const businesses = processImmediately
    ? await listSalesBusinessesByPostcodes(supabase, input.postcodes)
    : []

  return {
    inserted,
    skipped,
    scan_runs,
    businesses,
    jobs: refreshedJobs,
  }
}

export { BUSINESS_DISCOVERY_AGENT_ID }
