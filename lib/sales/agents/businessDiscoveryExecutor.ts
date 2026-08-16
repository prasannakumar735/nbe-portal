import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBusinessResultForInsert } from '@/lib/sales/agents/normalizeBusinessResult'
import { searchGooglePlacesBusinesses } from '@/lib/sales/providers/googlePlacesProvider'
import {
  getCachedBusinessesIfFresh,
  getSalesBusinessSummary,
  insertSalesBusinessesSkipDuplicates,
  setPostcodeScannedAt,
} from '@/lib/sales/repositories/salesBusinessRepository'
import {
  completeSalesScanRun,
  createSalesScanRun,
  failSalesScanRun,
} from '@/lib/sales/repositories/salesScanRunRepository'
import type { BusinessDiscoveryJobPayload } from '@/lib/sales/jobs/job.types'

const LOG_PREFIX = '[businessDiscovery]'

/** Postcode cache TTL — skip Google when `sales_businesses.scanned_at` is newer than this. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type BusinessDiscoveryJobResult = {
  scan_run_id: string
  postcode: string
  cached: boolean
  durationMs: number
  googleReturned: number
  inserted: number
  updated: number
  existing: number
  duplicatesSkipped: number
  totalFound: number
  failed: number
}

/**
 * Worker invoked by jobProcessor — runs one discovery job (single postcode).
 */
export async function executeBusinessDiscoveryJob(
  supabase: SupabaseClient,
  payload: BusinessDiscoveryJobPayload,
): Promise<BusinessDiscoveryJobResult> {
  const startedAt = Date.now()
  const { postcode, categories, created_by: createdBy, refresh_from_google: refreshFromGoogle } =
    payload

  console.info(`${LOG_PREFIX} executeBusinessDiscoveryJob`, {
    handler: 'lib/sales/agents/businessDiscoveryExecutor.ts executeBusinessDiscoveryJob',
    postcode,
    refreshFromGoogle: Boolean(refreshFromGoogle),
  })

  const scanRun = await createSalesScanRun(supabase, {
    postcode,
    status: 'running',
    created_by: createdBy,
  })

  try {
    const useCache = !refreshFromGoogle
    const cache = useCache
      ? await getCachedBusinessesIfFresh(supabase, postcode, CACHE_TTL_MS)
      : { hit: false as const }

    if (cache.hit) {
      const summary = await getSalesBusinessSummary(supabase, { postcode })
      const durationMs = Date.now() - startedAt
      console.info(`${LOG_PREFIX} cache hit`, {
        postcode,
        totalFound: summary.total,
        durationMs,
      })
      await completeSalesScanRun(supabase, scanRun.id, {
        status: 'completed',
        total_found: summary.total,
      })
      return {
        scan_run_id: scanRun.id,
        postcode,
        cached: true,
        durationMs,
        googleReturned: 0,
        inserted: 0,
        updated: 0,
        existing: summary.total,
        duplicatesSkipped: 0,
        totalFound: summary.total,
        failed: 0,
      }
    }

    console.info(`${LOG_PREFIX} cache miss`, { postcode, refreshFromGoogle: Boolean(refreshFromGoogle) })

    const results = await searchGooglePlacesBusinesses(postcode, categories)
    const googleReturned = results.length
    console.info(`${LOG_PREFIX} businesses returned from Google Places`, {
      postcode,
      count: googleReturned,
    })

    const scannedAt = new Date().toISOString()
    const toPersist = results.map((result) => ({
      ...normalizeBusinessResultForInsert(result, scanRun.id),
      scanned_at: scannedAt,
    }))

    const persist = await insertSalesBusinessesSkipDuplicates(supabase, toPersist)

    console.info(`${LOG_PREFIX} persist complete`, {
      postcode,
      googleReturned,
      inserted: persist.inserted,
      updated: persist.updated,
      existing: persist.existing,
      duplicatesSkipped: persist.duplicatesSkipped,
      failed: persist.failed,
    })

    if (googleReturned > 0) {
      await setPostcodeScannedAt(supabase, postcode, scannedAt)
    }

    const summary = await getSalesBusinessSummary(supabase, { postcode })
    const durationMs = Date.now() - startedAt

    await completeSalesScanRun(supabase, scanRun.id, {
      status: 'completed',
      total_found: summary.total,
    })

    return {
      scan_run_id: scanRun.id,
      postcode,
      cached: false,
      durationMs,
      googleReturned,
      inserted: persist.inserted,
      updated: persist.updated,
      existing: persist.existing,
      duplicatesSkipped: persist.duplicatesSkipped,
      totalFound: summary.total,
      failed: persist.failed,
    }
  } catch (error) {
    await failSalesScanRun(supabase, scanRun.id)
    throw error
  }
}
