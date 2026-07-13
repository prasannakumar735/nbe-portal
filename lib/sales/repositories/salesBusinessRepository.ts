import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesBusiness,
  SalesBusinessInsert,
  SalesBusinessListResult,
  SalesBusinessStatus,
  SalesBusinessSummary,
  BusinessDiscoveryPersistStats,
} from '@/lib/sales/types/business.types'

const TABLE = 'sales_businesses'
const LOG_PREFIX = '[salesBusinessRepository]'
const POSTCODE_LIST_PAGE = 1000
const INSERT_CHUNK_SIZE = 100

type PostgrestErrorShape = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

function parsePostgrestInsertDiagnostics(error: PostgrestErrorShape): {
  constraintName?: string
  failingColumn?: string
  sqlState?: string
} {
  const message = error.message ?? ''
  const constraintFromMessage =
    message.match(/unique constraint "([^"]+)"/i) ??
    message.match(/constraint "([^"]+)"/i)
  const details = error.details ?? ''
  const keyExpr = details.match(/^Key \(([^)]+)\)=/)
  return {
    constraintName: constraintFromMessage?.[1],
    failingColumn: keyExpr?.[1],
    sqlState: error.code,
  }
}

/** Log and rethrow Supabase/PostgREST errors without masking. */
function throwInsertError(payload: Record<string, unknown>[], error: unknown): never {
  console.error(`[${TABLE}] Table:`, TABLE)
  console.error(`[${TABLE}] Insert Payload:`, payload)
  console.error(`[${TABLE}] Raw Error:`, error)

  const pg =
    error && typeof error === 'object' ? (error as PostgrestErrorShape) : ({} as PostgrestErrorShape)
  const diagnostics = parsePostgrestInsertDiagnostics(pg)

  console.error(`[${TABLE}] PostgREST / PostgreSQL error fields:`, {
    message: pg.message,
    details: pg.details,
    hint: pg.hint,
    code: pg.code,
    constraintName: diagnostics.constraintName,
    failingColumn: diagnostics.failingColumn,
    sqlState: diagnostics.sqlState,
  })

  if (error && typeof error === 'object') {
    console.error(`[${TABLE}] Error JSON:`, JSON.stringify(error, null, 2))
  }

  throw error
}

function businessKey(companyName: string, postcode: string): string {
  return `${companyName.trim().toLowerCase()}|${postcode.trim()}`
}

function placeIdFromPayload(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw || typeof raw.place_id !== 'string') return null
  const id = raw.place_id.trim()
  return id.length > 0 ? id : null
}

function stablePayloadJson(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) return 'null'
  return JSON.stringify(raw)
}

function discoveryFieldsChanged(
  existing: SalesBusiness,
  incoming: SalesBusinessInsert,
): boolean {
  const norm = (v: string | null | undefined) => (v ?? '').trim()
  if (norm(existing.address) !== norm(incoming.address)) return true
  if (norm(existing.suburb) !== norm(incoming.suburb)) return true
  if (norm(existing.website) !== norm(incoming.website)) return true
  if (norm(existing.phone) !== norm(incoming.phone)) return true
  if (norm(existing.category) !== norm(incoming.category)) return true
  if (stablePayloadJson(existing.raw_payload) !== stablePayloadJson(incoming.raw_payload ?? null)) {
    return true
  }
  return false
}

function dedupeDiscoveryPayload(rows: SalesBusinessInsert[]): {
  rows: SalesBusinessInsert[]
  duplicatesSkipped: number
} {
  const seenPlaceIds = new Set<string>()
  const seenKeys = new Set<string>()
  const out: SalesBusinessInsert[] = []
  let duplicatesSkipped = 0

  for (const row of rows) {
    const placeId = placeIdFromPayload(row.raw_payload ?? null)
    const key = businessKey(row.company_name, row.postcode)
    if (placeId && seenPlaceIds.has(placeId)) {
      duplicatesSkipped += 1
      continue
    }
    if (seenKeys.has(key)) {
      duplicatesSkipped += 1
      continue
    }
    if (placeId) seenPlaceIds.add(placeId)
    seenKeys.add(key)
    out.push(row)
  }

  return { rows: out, duplicatesSkipped }
}

function mapRow(row: Record<string, unknown>): SalesBusiness {
  const raw = row.raw_payload
  return {
    id: String(row.id),
    scan_run_id: row.scan_run_id != null ? String(row.scan_run_id) : null,
    company_name: String(row.company_name),
    address: row.address != null ? String(row.address) : null,
    suburb: row.suburb != null ? String(row.suburb) : null,
    postcode: String(row.postcode),
    website: row.website != null ? String(row.website) : null,
    phone: row.phone != null ? String(row.phone) : null,
    category: row.category != null ? String(row.category) : null,
    source: row.source as SalesBusiness['source'],
    status: row.status as SalesBusiness['status'],
    selected: Boolean(row.selected),
    last_contacted_at:
      row.last_contacted_at != null ? String(row.last_contacted_at) : null,
    contact_attempts: Number(row.contact_attempts ?? 0),
    raw_payload:
      raw != null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null,
    scanned_at: row.scanned_at != null ? String(row.scanned_at) : null,
    created_at: String(row.created_at),
  }
}

export async function listSalesBusinesses(
  supabase: SupabaseClient,
  options: { page: number; pageSize: number; postcode?: string; scanRunId?: string },
): Promise<SalesBusinessListResult> {
  const { page, pageSize, postcode, scanRunId } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (postcode) {
    query = query.eq('postcode', postcode)
  }
  if (scanRunId) {
    query = query.eq('scan_run_id', scanRunId)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  return {
    rows: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function getSalesBusinessSummary(
  supabase: SupabaseClient,
  options?: { postcode?: string },
): Promise<SalesBusinessSummary> {
  let totalQuery = supabase.from(TABLE).select('*', { count: 'exact', head: true })
  let selectedQuery = supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('selected', true)

  if (options?.postcode) {
    totalQuery = totalQuery.eq('postcode', options.postcode)
    selectedQuery = selectedQuery.eq('postcode', options.postcode)
  }

  const [totalRes, selectedRes] = await Promise.all([totalQuery, selectedQuery])
  if (totalRes.error) throw totalRes.error
  if (selectedRes.error) throw selectedRes.error

  return {
    total: totalRes.count ?? 0,
    selected: selectedRes.count ?? 0,
  }
}

export async function getSalesBusinessById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesBusiness | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesBusinessesByPostcodes(
  supabase: SupabaseClient,
  postcodes: string[],
): Promise<SalesBusiness[]> {
  if (postcodes.length === 0) return []

  const all: SalesBusiness[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .in('postcode', postcodes)
      .order('created_at', { ascending: false })
      .range(from, from + POSTCODE_LIST_PAGE - 1)

    if (error) throw error
    const batch = (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
    all.push(...batch)
    if (batch.length < POSTCODE_LIST_PAGE) break
    from += POSTCODE_LIST_PAGE
  }

  return all
}

export type PostcodeCacheLookup = { hit: true; businesses: SalesBusiness[] } | { hit: false }

/**
 * Returns cached businesses when the postcode was scanned within `maxAgeMs`.
 * Rows with null `scanned_at` are treated as stale.
 */
export async function getCachedBusinessesIfFresh(
  supabase: SupabaseClient,
  postcode: string,
  maxAgeMs: number,
): Promise<PostcodeCacheLookup> {
  const businesses = await listSalesBusinessesByPostcodes(supabase, [postcode])
  if (businesses.length === 0) {
    return { hit: false }
  }

  let latestMs = 0
  for (const b of businesses) {
    if (!b.scanned_at) {
      return { hit: false }
    }
    const t = Date.parse(b.scanned_at)
    if (Number.isNaN(t) || t > latestMs) {
      latestMs = t
    }
  }

  if (latestMs === 0 || Date.now() - latestMs > maxAgeMs) {
    return { hit: false }
  }

  return { hit: true, businesses }
}

/** Sets `scanned_at` on all businesses for a postcode (after a successful external scan). */
export async function setPostcodeScannedAt(
  supabase: SupabaseClient,
  postcode: string,
  scannedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ scanned_at: scannedAt })
    .eq('postcode', postcode)
  if (error) {
    console.error(`${LOG_PREFIX} setPostcodeScannedAt() failed`, {
      table: TABLE,
      postcode,
      scannedAt,
      rawError: error,
      errorJson: JSON.stringify(error, null, 2),
    })
    throw error
  }
}

export async function insertSalesBusinessesSkipDuplicates(
  supabase: SupabaseClient,
  rows: SalesBusinessInsert[],
): Promise<BusinessDiscoveryPersistStats & { insertedRows: SalesBusiness[] }> {
  const empty: BusinessDiscoveryPersistStats & { insertedRows: SalesBusiness[] } = {
    inserted: 0,
    updated: 0,
    existing: 0,
    duplicatesSkipped: 0,
    failed: 0,
    insertedRows: [],
  }
  if (rows.length === 0) return empty

  const { rows: deduped, duplicatesSkipped: payloadDupes } = dedupeDiscoveryPayload(rows)
  const postcodes = [...new Set(deduped.map((r) => r.postcode))]
  const existingList = await listSalesBusinessesByPostcodes(supabase, postcodes)

  const byPlaceId = new Map<string, SalesBusiness>()
  const byBusinessKey = new Map<string, SalesBusiness>()
  for (const e of existingList) {
    const pid = placeIdFromPayload(e.raw_payload)
    if (pid) byPlaceId.set(pid, e)
    byBusinessKey.set(businessKey(e.company_name, e.postcode), e)
  }

  let inserted = 0
  let updated = 0
  let existing = 0
  let failed = 0
  const insertedRows: SalesBusiness[] = []
  const toInsert: Record<string, unknown>[] = []

  const findExisting = (row: SalesBusinessInsert): SalesBusiness | undefined => {
    const pid = placeIdFromPayload(row.raw_payload ?? null)
    if (pid && byPlaceId.has(pid)) return byPlaceId.get(pid)
    return byBusinessKey.get(businessKey(row.company_name, row.postcode))
  }

  for (const row of deduped) {
    const match = findExisting(row)
    if (match) {
      if (!discoveryFieldsChanged(match, row)) {
        existing += 1
        continue
      }
      const patch: Record<string, unknown> = {}
      if ((match.address ?? '').trim() !== row.address.trim()) patch.address = row.address
      if ((match.suburb ?? '').trim() !== row.suburb.trim()) patch.suburb = row.suburb
      if ((match.website ?? '').trim() !== (row.website ?? '').trim()) patch.website = row.website
      if ((match.phone ?? '').trim() !== (row.phone ?? '').trim()) patch.phone = row.phone
      if ((match.category ?? '').trim() !== row.category.trim()) patch.category = row.category
      if (stablePayloadJson(match.raw_payload) !== stablePayloadJson(row.raw_payload ?? null)) {
        patch.raw_payload = row.raw_payload ?? null
      }
      if (row.scan_run_id) patch.scan_run_id = row.scan_run_id

      const { data, error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq('id', match.id)
        .select('*')
        .maybeSingle()
      if (error || !data) {
        failed += 1
        console.error(`${LOG_PREFIX} update failed`, { id: match.id, error })
        continue
      }
      updated += 1
      const mapped = mapRow(data as Record<string, unknown>)
      const pid = placeIdFromPayload(mapped.raw_payload)
      if (pid) byPlaceId.set(pid, mapped)
      byBusinessKey.set(businessKey(mapped.company_name, mapped.postcode), mapped)
      continue
    }

    toInsert.push({
      scan_run_id: row.scan_run_id,
      company_name: row.company_name,
      address: row.address,
      suburb: row.suburb,
      postcode: row.postcode,
      website: row.website,
      phone: row.phone,
      category: row.category,
      source: row.source,
      status: row.status ?? 'new',
      selected: row.selected ?? false,
      last_contacted_at: row.last_contacted_at ?? null,
      contact_attempts: row.contact_attempts ?? 0,
      raw_payload: row.raw_payload ?? null,
      scanned_at: row.scanned_at ?? null,
    })
  }

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE)
    const { data, error } = await supabase.from(TABLE).insert(chunk).select('*')
    if (!error) {
      const mapped = (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
      inserted += mapped.length
      insertedRows.push(...mapped)
      for (const m of mapped) {
        const pid = placeIdFromPayload(m.raw_payload)
        if (pid) byPlaceId.set(pid, m)
        byBusinessKey.set(businessKey(m.company_name, m.postcode), m)
      }
      continue
    }

    for (const single of chunk) {
      const { data: one, error: oneErr } = await supabase
        .from(TABLE)
        .insert(single)
        .select('*')
        .maybeSingle()
      if (oneErr) {
        if (oneErr.code === '23505') {
          existing += 1
          continue
        }
        failed += 1
        console.error(`${LOG_PREFIX} insert row failed`, { single, error: oneErr })
        continue
      }
      if (one) {
        inserted += 1
        const mapped = mapRow(one as Record<string, unknown>)
        insertedRows.push(mapped)
        const pid = placeIdFromPayload(mapped.raw_payload)
        if (pid) byPlaceId.set(pid, mapped)
        byBusinessKey.set(businessKey(mapped.company_name, mapped.postcode), mapped)
      }
    }

    if (error && chunk.length > 1) {
      console.error(`${LOG_PREFIX} chunk insert failed, retried per row`, {
        chunkSize: chunk.length,
        error,
      })
    }
  }

  const stats: BusinessDiscoveryPersistStats = {
    inserted,
    updated,
    existing,
    duplicatesSkipped: payloadDupes,
    failed,
  }
  console.info(`${LOG_PREFIX} persist stats`, stats)
  return { ...stats, insertedRows }
}

export async function updateSalesBusinessSelected(
  supabase: SupabaseClient,
  id: string,
  selected: boolean,
): Promise<SalesBusiness> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ selected })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Business not found.')
  return mapRow(data as Record<string, unknown>)
}

/** Used by email / follow-up agents after a successful outbound contact. */
export async function recordSalesBusinessContactAttempt(
  supabase: SupabaseClient,
  id: string,
  options?: { status?: SalesBusinessStatus; contactedAt?: string },
): Promise<SalesBusiness> {
  const existing = await supabase.from(TABLE).select('contact_attempts').eq('id', id).maybeSingle()
  if (existing.error) throw existing.error
  if (!existing.data) throw new Error('Business not found.')

  const attempts = Number((existing.data as { contact_attempts?: number }).contact_attempts ?? 0) + 1
  const patch: Record<string, unknown> = {
    contact_attempts: attempts,
    last_contacted_at: options?.contactedAt ?? new Date().toISOString(),
  }
  if (options?.status) {
    patch.status = options.status
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Business not found.')
  return mapRow(data as Record<string, unknown>)
}
