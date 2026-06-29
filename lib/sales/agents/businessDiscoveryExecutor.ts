import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBusinessResultForInsert } from '@/lib/sales/agents/normalizeBusinessResult'
import { getBusinessProvider } from '@/lib/sales/providers'
import { insertSalesBusinessesSkipDuplicates } from '@/lib/sales/repositories/salesBusinessRepository'
import {
  completeSalesScanRun,
  createSalesScanRun,
  failSalesScanRun,
} from '@/lib/sales/repositories/salesScanRunRepository'
import type { BusinessDiscoveryJobPayload } from '@/lib/sales/jobs/job.types'

const MAX_RESULTS_PER_JOB = 50

export type BusinessDiscoveryJobResult = {
  scan_run_id: string
  postcode: string
  inserted: number
  skipped: number
  total_found: number
}

/**
 * Worker invoked by jobProcessor — runs one discovery job (single postcode).
 */
export async function executeBusinessDiscoveryJob(
  supabase: SupabaseClient,
  payload: BusinessDiscoveryJobPayload,
): Promise<BusinessDiscoveryJobResult> {
  const provider = getBusinessProvider()
  const { postcode, categories, created_by: createdBy } = payload

  const scanRun = await createSalesScanRun(supabase, {
    postcode,
    status: 'running',
    created_by: createdBy,
  })

  try {
    const results = await provider.searchBusinesses(postcode, categories)
    const capped = results.slice(0, MAX_RESULTS_PER_JOB)
    const toInsert = capped.map((result) =>
      normalizeBusinessResultForInsert(result, scanRun.id),
    )

    const { inserted, skipped } = await insertSalesBusinessesSkipDuplicates(supabase, toInsert)

    await completeSalesScanRun(supabase, scanRun.id, {
      status: 'completed',
      total_found: capped.length,
    })

    return {
      scan_run_id: scanRun.id,
      postcode,
      inserted: inserted.length,
      skipped,
      total_found: capped.length,
    }
  } catch (error) {
    await failSalesScanRun(supabase, scanRun.id)
    throw error
  }
}
