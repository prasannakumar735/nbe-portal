import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesContact,
  SalesContactInsert,
  SalesContactVerificationPatch,
} from '@/lib/sales/types/contact.types'
import type { ContactDiscoveryMethod, ContactPageKind } from '@/lib/sales/types/contactDiscovery.types'
import { normalizeSalesContactType } from '@/lib/sales/types/contactSources'

const TABLE = 'sales_contacts'

function parseDiscoveryMethod(raw: unknown): ContactDiscoveryMethod | null {
  if (raw === 'mailto' || raw === 'mailto_labeled' || raw === 'body_text' || raw === 'tel') {
    return raw
  }
  return null
}

function parsePageKind(raw: unknown): ContactPageKind | null {
  const kinds: ContactPageKind[] = [
    'homepage',
    'contact',
    'quote',
    'sales',
    'locations_hub',
    'branch',
    'service',
    'other',
  ]
  if (typeof raw === 'string' && (kinds as string[]).includes(raw)) {
    return raw as ContactPageKind
  }
  return null
}

function mapRow(row: Record<string, unknown>): SalesContact {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    contact_page: row.contact_page != null ? String(row.contact_page) : null,
    contact_type: normalizeSalesContactType(String(row.contact_type ?? 'unknown')),
    confidence_score: Number(row.confidence_score ?? 50),
    is_primary: Boolean(row.is_primary),
    source: row.source as SalesContact['source'],
    email_verified: Boolean(row.email_verified),
    verification_status: row.verification_status as SalesContact['verification_status'],
    created_at: String(row.created_at),
    discovery_page_title:
      row.discovery_page_title != null ? String(row.discovery_page_title) : null,
    discovery_method: parseDiscoveryMethod(row.discovery_method),
    page_kind: parsePageKind(row.page_kind),
    recommended_for_outreach: Boolean(row.recommended_for_outreach),
    recommended_reason: row.recommended_reason != null ? String(row.recommended_reason) : null,
  }
}

function rowToDb(r: SalesContactInsert): Record<string, unknown> {
  return {
    business_id: r.business_id,
    email: r.email ?? null,
    phone: r.phone ?? null,
    contact_page: r.contact_page ?? null,
    contact_type: r.contact_type ?? 'unknown',
    confidence_score: r.confidence_score ?? 50,
    is_primary: r.is_primary ?? false,
    source: r.source,
    email_verified: r.email_verified ?? false,
    verification_status: r.verification_status ?? 'unknown',
    discovery_page_title: r.discovery_page_title ?? null,
    discovery_method: r.discovery_method ?? null,
    page_kind: r.page_kind ?? null,
    recommended_for_outreach: r.recommended_for_outreach ?? false,
    recommended_reason: r.recommended_reason ?? null,
  }
}

export async function listSalesContactsByBusinessId(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SalesContact[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('business_id', businessId)
    .order('confidence_score', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function listSalesContactsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<SalesContact[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from(TABLE).select('*').in('id', ids)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function insertSalesContactsSkipDuplicates(
  supabase: SupabaseClient,
  rows: SalesContactInsert[],
): Promise<{ inserted: SalesContact[]; skipped: number }> {
  if (rows.length === 0) return { inserted: [], skipped: 0 }

  const businessId = rows[0].business_id
  const existing = await listSalesContactsByBusinessId(supabase, businessId)
  const existingEmails = new Set(
    existing.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[],
  )

  const toInsert = rows.filter((r) => {
    if (!r.email) return true
    const key = r.email.toLowerCase()
    return !existingEmails.has(key)
  })
  const skipped = rows.length - toInsert.length

  if (toInsert.length === 0) return { inserted: [], skipped }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(toInsert.map((r) => rowToDb(r)))
    .select('*')
  if (error) throw error

  return {
    inserted: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    skipped,
  }
}

export async function upsertSalesContactsFromDiscovery(
  supabase: SupabaseClient,
  businessId: string,
  rows: SalesContactInsert[],
): Promise<{ inserted: SalesContact[]; updated: SalesContact[] }> {
  const existing = await listSalesContactsByBusinessId(supabase, businessId)
  const byEmail = new Map(
    existing.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c] as const),
  )

  const inserted: SalesContact[] = []
  const updated: SalesContact[] = []

  for (const row of rows) {
    if (!row.email) continue
    const key = row.email.toLowerCase()
    const match = byEmail.get(key)
    if (match) {
      const { data, error } = await supabase
        .from(TABLE)
        .update({
          phone: row.phone ?? match.phone,
          contact_page: row.contact_page ?? match.contact_page,
          contact_type: row.contact_type ?? match.contact_type,
          confidence_score: row.confidence_score ?? match.confidence_score,
          discovery_page_title: row.discovery_page_title ?? null,
          discovery_method: row.discovery_method ?? null,
          page_kind: row.page_kind ?? null,
          source: row.source,
        })
        .eq('id', match.id)
        .eq('business_id', businessId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (data) updated.push(mapRow(data as Record<string, unknown>))
      continue
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(rowToDb({ ...row, business_id: businessId }))
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (data) {
      const mapped = mapRow(data as Record<string, unknown>)
      inserted.push(mapped)
      if (mapped.email) byEmail.set(mapped.email.toLowerCase(), mapped)
    }
  }

  return { inserted, updated }
}

export async function setRecommendedSalesContacts(
  supabase: SupabaseClient,
  businessId: string,
  recommendations: Array<{ contactId: string; reason: string }>,
): Promise<void> {
  const { error: clearError } = await supabase
    .from(TABLE)
    .update({ recommended_for_outreach: false, recommended_reason: null })
    .eq('business_id', businessId)
  if (clearError) throw clearError

  for (const rec of recommendations) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        recommended_for_outreach: true,
        recommended_reason: rec.reason,
      })
      .eq('id', rec.contactId)
      .eq('business_id', businessId)
    if (error) throw error
  }
}

export async function setPrimarySalesContact(
  supabase: SupabaseClient,
  businessId: string,
  contactId: string,
): Promise<void> {
  const { error: clearError } = await supabase
    .from(TABLE)
    .update({ is_primary: false })
    .eq('business_id', businessId)
  if (clearError) throw clearError

  const { error } = await supabase
    .from(TABLE)
    .update({ is_primary: true })
    .eq('id', contactId)
    .eq('business_id', businessId)
  if (error) throw error
}

export async function updateSalesContactVerification(
  supabase: SupabaseClient,
  contactId: string,
  businessId: string,
  patch: SalesContactVerificationPatch,
): Promise<SalesContact> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      email_verified: patch.email_verified,
      verification_status: patch.verification_status,
    })
    .eq('id', contactId)
    .eq('business_id', businessId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Contact not found.')
  return mapRow(data as Record<string, unknown>)
}
