import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesContact,
  SalesContactInsert,
  SalesContactVerificationPatch,
} from '@/lib/sales/types/contact.types'

const TABLE = 'sales_contacts'

function mapRow(row: Record<string, unknown>): SalesContact {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    contact_page: row.contact_page != null ? String(row.contact_page) : null,
    contact_type: row.contact_type as SalesContact['contact_type'],
    confidence_score: Number(row.confidence_score ?? 50),
    is_primary: Boolean(row.is_primary),
    source: row.source as SalesContact['source'],
    email_verified: Boolean(row.email_verified),
    verification_status: row.verification_status as SalesContact['verification_status'],
    created_at: String(row.created_at),
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
    .insert(
      toInsert.map((r) => ({
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
      })),
    )
    .select('*')
  if (error) throw error

  return {
    inserted: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    skipped,
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
