/**
 * Compare Google Places discovery payload vs sales_businesses for duplicate-key conflicts.
 * Run: npx tsx scripts/verify-sales-business-duplicates.ts [postcode]
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { normalizeBusinessResultForInsert } from '@/lib/sales/agents/normalizeBusinessResult'
import { PVC_DISCOVERY_CATEGORIES } from '@/lib/sales/constants/discoveryCategories'
import { searchGooglePlacesBusinesses } from '@/lib/sales/providers/googlePlacesProvider'
import type { BusinessResult } from '@/lib/sales/types/business.types'

function loadEnv(name: string): string {
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    if (t.slice(0, i).trim() !== name) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    return v
  }
  throw new Error(`Missing ${name}`)
}

function businessKey(companyName: string, postcode: string): string {
  return `${companyName.trim().toLowerCase()}|${postcode.trim()}`
}

const MAX_RESULTS = 50
const FAKE_SCAN_RUN_ID = '00000000-0000-0000-0000-000000000000'

type DbRow = { id: string; company_name: string; postcode: string }

function analyzeBatch(
  label: string,
  googleBatch: BusinessResult[],
  dbByKey: Map<string, DbRow[]>,
) {
  const payload = googleBatch.map((r) => normalizeBusinessResultForInsert(r, FAKE_SCAN_RUN_ID))

  const payloadByKey = new Map<
    string,
    { index: number; company_name: string; postcode: string; place_id?: string }[]
  >()
  payload.forEach((row, index) => {
    const key = businessKey(row.company_name, row.postcode)
    const placeId =
      row.raw_payload && typeof row.raw_payload.place_id === 'string'
        ? row.raw_payload.place_id
        : undefined
    const list = payloadByKey.get(key) ?? []
    list.push({
      index,
      company_name: row.company_name,
      postcode: row.postcode,
      place_id: placeId,
    })
    payloadByKey.set(key, list)
  })

  const existingKeys = new Set(dbByKey.keys())
  const toInsert = payload.filter((r) => !existingKeys.has(businessKey(r.company_name, r.postcode)))
  const inBatchDuplicates = [...payloadByKey.entries()].filter(([, items]) => items.length > 1)

  const dbConflicts: {
    key: string
    db: DbRow[]
    payload: { index: number; company_name: string; place_id?: string }[]
  }[] = []
  for (const [key, items] of payloadByKey) {
    if (existingKeys.has(key)) {
      dbConflicts.push({ key, db: dbByKey.get(key)!, payload: items })
    }
  }

  const insertBatchKeyCounts = new Map<string, number>()
  for (const r of toInsert) {
    const key = businessKey(r.company_name, r.postcode)
    insertBatchKeyCounts.set(key, (insertBatchKeyCounts.get(key) ?? 0) + 1)
  }
  const insertBatchDuplicates = [...insertBatchKeyCounts.entries()].filter(([, n]) => n > 1)

  console.log(`\n========== ${label} (${googleBatch.length} places) ==========`)

  console.log('\n--- Duplicates WITHIN Google response (same dedupe key, different place_id) ---')
  if (inBatchDuplicates.length === 0) {
    console.log('None')
  } else {
    for (const [key, items] of inBatchDuplicates) {
      console.log(`\nKey: ${key}`)
      for (const item of items) {
        console.log(
          `  payload[${item.index}] name="${item.company_name}" place_id=${item.place_id ?? 'n/a'}`,
        )
      }
    }
  }

  console.log('\n--- Already in sales_businesses (skipped by pre-filter) ---')
  if (dbConflicts.length === 0) {
    console.log('None')
  } else {
    for (const c of dbConflicts) {
      console.log(`\nKey: ${c.key}`)
      for (const d of c.db) {
        console.log(`  DB id=${d.id} name="${d.company_name}"`)
      }
      for (const p of c.payload) {
        console.log(
          `  payload[${p.index}] name="${p.company_name}" place_id=${p.place_id ?? 'n/a'}`,
        )
      }
    }
  }

  console.log('\n--- Duplicates within toInsert (bulk insert would 23505) ---')
  if (insertBatchDuplicates.length === 0) {
    console.log('None')
  } else {
    for (const [key, count] of insertBatchDuplicates) {
      console.log(`\nKey: ${key} (×${count} in toInsert)`)
      for (const item of payloadByKey.get(key) ?? []) {
        console.log(
          `  payload[${item.index}] name="${item.company_name}" place_id=${item.place_id ?? 'n/a'}`,
        )
      }
    }
  }

  const verdict =
    insertBatchDuplicates.length > 0
      ? 'WITHIN_BATCH_DUPLICATE'
      : dbConflicts.length > 0 && toInsert.length === 0
        ? 'ALL_ALREADY_IN_DB (insert empty — should succeed)'
        : dbConflicts.length > 0
          ? 'PARTIAL_DB_OVERLAP (pre-filter should skip DB rows)'
          : 'NO_DEDUPE_KEY_CONFLICT'

  console.log('\n--- Summary ---', {
    payloadCount: payload.length,
    skippedByPreFilter: payload.length - toInsert.length,
    toInsertCount: toInsert.length,
    inGoogleResponseDuplicateKeys: inBatchDuplicates.length,
    dbOverlapKeys: dbConflicts.length,
    toInsertDuplicateKeys: insertBatchDuplicates.length,
    verdict,
  })

  return { insertBatchDuplicates, dbConflicts, inBatchDuplicates, toInsertCount: toInsert.length }
}

async function main() {
  const postcode = process.argv[2]?.trim() || '3025'

  for (const name of ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    process.env[name] = loadEnv(name)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: dbRows, error: dbErr } = await supabase
    .from('sales_businesses')
    .select('id, company_name, postcode')
    .eq('postcode', postcode)

  if (dbErr) {
    console.error('DB list error:', dbErr)
    process.exit(1)
  }

  const dbByKey = new Map<string, DbRow[]>()
  for (const row of dbRows ?? []) {
    const key = businessKey(String(row.company_name), String(row.postcode))
    const list = dbByKey.get(key) ?? []
    list.push({
      id: String(row.id),
      company_name: String(row.company_name),
      postcode: String(row.postcode),
    })
    dbByKey.set(key, list)
  }

  console.log(`\n=== Postcode ${postcode} ===`)
  console.log('--- Database (sales_businesses) ---')
  if ((dbRows ?? []).length === 0) {
    console.log('  (no rows)')
  }
  for (const row of dbRows ?? []) {
    const key = businessKey(String(row.company_name), String(row.postcode))
    console.log(`  id=${row.id} key=${key} name="${row.company_name}"`)
  }

  const results = await searchGooglePlacesBusinesses(postcode, [...PVC_DISCOVERY_CATEGORIES])
  const capped = results.slice(0, MAX_RESULTS)
  const first27 = results.slice(0, 27)

  const full = analyzeBatch('FULL Google response (all categories)', results, dbByKey)
  const job = analyzeBatch('JOB batch (slice 0..50 like executor)', capped, dbByKey)
  analyzeBatch('JOB batch (first 27 — reported run size)', first27, dbByKey)

  console.log('\n=== Overall conclusion ===')
  if (full.insertBatchDuplicates.length > 0 || job.insertBatchDuplicates.length > 0) {
    console.log(
      'Duplicate source: WITHIN current Google Places response (same company_name+postcode, different place_id).',
    )
  } else if (full.dbConflicts.length > 0 || job.dbConflicts.length > 0) {
    console.log(
      'Duplicate source: ALREADY IN sales_businesses. Pre-filter should skip these; 23505 only if a row slips through or batch has unseen dupes.',
    )
  } else if ((dbRows ?? []).length > 0 && job.toInsertCount > 0) {
    console.log(
      'DB has rows but none overlap this Google batch on dedupe key — inserts are all new names.',
    )
  } else {
    console.log('No dedupe-key conflicts detected in this run.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
