/**
 * Traces the same server path as Scan Businesses (without browser session).
 * Run: npx tsx --env-file=.env.local scripts/trace-business-discovery.ts [postcode]
 */
import { runBusinessDiscoveryAgent } from '../lib/sales/agents/businessDiscoveryAgent'
import { createServiceRoleClient } from '../lib/supabase/serviceRole'

const postcode = process.argv[2]?.trim() || '3025'

async function main() {
  console.info('[trace] Simulating Scan Businesses server path for postcode', postcode)
  console.info('[trace] Expected chain:')
  console.info('  hooks/useBusinessScan.ts scan()')
  console.info('  → POST /api/sales/discovery/scan')
  console.info('  → runBusinessDiscoveryAgent')
  console.info('  → processSalesJobs → executeBusinessDiscoveryJob')
  console.info('  → searchGooglePlacesBusinesses (cache miss)')
  console.info('')

  const supabase = createServiceRoleClient()
  const result = await runBusinessDiscoveryAgent(supabase, {
    postcodes: [postcode],
    createdBy: '577fb1a7-ecbe-4326-bea2-99f0baaed9a3',
    categories: ['warehouse'],
    processImmediately: true,
  })

  console.info('[trace] Agent result summary', {
    results: result.results,
  })
}

main().catch((err) => {
  console.error('[trace] failed', err)
  process.exit(1)
})
