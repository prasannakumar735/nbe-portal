import type { SupabaseClient } from '@supabase/supabase-js'
import { BUSINESS_DISCOVERY_AGENT_ID } from '@/lib/sales/agents/businessDiscoveryAgent.constants'
import type { BusinessDiscoveryJobResult } from '@/lib/sales/agents/businessDiscoveryExecutor'
import { PVC_DISCOVERY_CATEGORIES } from '@/lib/sales/constants/discoveryCategories'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import type { SalesJob, SalesJobProcessResult } from '@/lib/sales/jobs/job.types'
import { createSalesJobs } from '@/lib/sales/jobs/salesJobRepository'
import type { BusinessDiscoveryScanApiResponse, BusinessDiscoveryScanResult } from '@/lib/sales/types/business.types'

const LOG_PREFIX = '[businessDiscovery]'

export type BusinessDiscoveryAgentInput = {
  postcodes: string[]
  createdBy: string
  categories?: string[]
  refreshFromGoogle?: boolean
  /** When true (default), pending jobs are processed in-process after enqueue. */
  processImmediately?: boolean
}

export type BusinessDiscoveryEnqueueResult = {
  jobs: SalesJob[]
}

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
        refresh_from_google: input.refreshFromGoogle === true,
      },
    })),
  )
  return { jobs }
}

function toScanResult(
  jobId: string,
  result: BusinessDiscoveryJobResult | undefined,
  postcode: string,
): BusinessDiscoveryScanResult {
  if (!result) {
    return {
      jobId,
      postcode,
      cached: false,
      durationMs: 0,
      googleReturned: 0,
      inserted: 0,
      updated: 0,
      existing: 0,
      duplicatesSkipped: 0,
      totalFound: 0,
      failed: 0,
    }
  }
  return {
    jobId,
    postcode: result.postcode ?? postcode,
    cached: result.cached,
    durationMs: result.durationMs,
    googleReturned: result.googleReturned,
    inserted: result.inserted,
    updated: result.updated,
    existing: result.existing,
    duplicatesSkipped: result.duplicatesSkipped,
    totalFound: result.totalFound,
    failed: result.failed,
  }
}

export async function runBusinessDiscoveryAgent(
  supabase: SupabaseClient,
  input: BusinessDiscoveryAgentInput,
): Promise<BusinessDiscoveryScanApiResponse> {
  console.info(`${LOG_PREFIX} runBusinessDiscoveryAgent`, {
    handler: 'lib/sales/agents/businessDiscoveryAgent.ts runBusinessDiscoveryAgent',
    postcodes: input.postcodes,
    refreshFromGoogle: Boolean(input.refreshFromGoogle),
  })

  const { jobs } = await enqueueBusinessDiscoveryScan(supabase, input)
  const processImmediately = input.processImmediately !== false

  let processResults: SalesJobProcessResult[] = []
  if (processImmediately && jobs.length > 0) {
    processResults = await processSalesJobs(supabase, {
      jobIds: jobs.map((j) => j.id),
      limit: jobs.length,
    })
  }

  const results: BusinessDiscoveryScanResult[] = []
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const processed = processResults.find((p) => p.job_id === job.id)
    const payloadPostcode =
      typeof job.payload.postcode === 'string' ? job.payload.postcode : input.postcodes[i] ?? ''
    results.push(
      toScanResult(
        job.id,
        processed?.result as BusinessDiscoveryJobResult | undefined,
        payloadPostcode,
      ),
    )
  }

  if (processImmediately) {
    for (const r of results) {
      console.info(`${LOG_PREFIX} scan stats`, r)
    }
  }

  return { results }
}

export { BUSINESS_DISCOVERY_AGENT_ID }
