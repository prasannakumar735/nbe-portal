import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesBusiness,
  SalesBusinessInsert,
  SalesBusinessListResult,
  SalesBusinessStatus,
  SalesBusinessSummary,
} from '@/lib/sales/types/business.types'

const TABLE = 'sales_businesses'

function businessKey(companyName: string, postcode: string): string {
  return `${companyName.trim().toLowerCase()}|${postcode.trim()}`
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
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('postcode', postcodes)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function insertSalesBusinessesSkipDuplicates(
  supabase: SupabaseClient,
  rows: SalesBusinessInsert[],
): Promise<{ inserted: SalesBusiness[]; skipped: number }> {
  if (rows.length === 0) {
    return { inserted: [], skipped: 0 }
  }

  const postcodes = [...new Set(rows.map((r) => r.postcode))]
  const existing = await listSalesBusinessesByPostcodes(supabase, postcodes)
  const existingKeys = new Set(existing.map((e) => businessKey(e.company_name, e.postcode)))

  const toInsert = rows.filter((r) => !existingKeys.has(businessKey(r.company_name, r.postcode)))
  const skipped = rows.length - toInsert.length

  if (toInsert.length === 0) {
    return { inserted: [], skipped }
  }

  const payload = toInsert.map((r) => ({
    scan_run_id: r.scan_run_id,
    company_name: r.company_name,
    address: r.address,
    suburb: r.suburb,
    postcode: r.postcode,
    website: r.website,
    phone: r.phone,
    category: r.category,
    source: r.source,
    status: r.status ?? 'new',
    selected: r.selected ?? false,
    last_contacted_at: r.last_contacted_at ?? null,
    contact_attempts: r.contact_attempts ?? 0,
    raw_payload: r.raw_payload ?? null,
  }))

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*')
  if (error) throw error

  return {
    inserted: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    skipped,
  }
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
