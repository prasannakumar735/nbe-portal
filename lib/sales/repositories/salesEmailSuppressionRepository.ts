import type { SupabaseClient } from '@supabase/supabase-js'
import { isSalesEmailSuppressionReason } from '@/lib/sales/constants/suppressionReasons'
import { normalizeEmailForSuppression } from '@/lib/sales/suppression/normalizeEmail'
import type {
  SalesEmailSuppression,
  SalesEmailSuppressionInsert,
} from '@/lib/sales/types/emailSuppression.types'

const TABLE = 'sales_email_suppressions'

export class SalesEmailSuppressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesEmailSuppressionError'
  }
}

function mapRow(row: Record<string, unknown>): SalesEmailSuppression {
  const reason = String(row.reason)
  return {
    id: String(row.id),
    email_address: String(row.email_address),
    reason: isSalesEmailSuppressionReason(reason) ? reason : 'manual',
    contact_id: row.contact_id != null ? String(row.contact_id) : null,
    campaign_id: row.campaign_id != null ? String(row.campaign_id) : null,
    notes: row.notes != null ? String(row.notes) : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}

/**
 * Add an address to the do-not-email list. Idempotent: a repeat opt-out keeps
 * the original record (and its original reason/timestamp) rather than erroring.
 */
export async function addSalesEmailSuppression(
  supabase: SupabaseClient,
  input: SalesEmailSuppressionInsert,
): Promise<SalesEmailSuppression | null> {
  const email_address = normalizeEmailForSuppression(input.email_address)
  if (!email_address) {
    throw new SalesEmailSuppressionError('Cannot suppress an empty email address.')
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        email_address,
        reason: input.reason,
        contact_id: input.contact_id ?? null,
        campaign_id: input.campaign_id ?? null,
        notes: input.notes ?? null,
        created_by: input.created_by ?? null,
      },
      { onConflict: 'email_address', ignoreDuplicates: true },
    )
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data ? mapRow(data as Record<string, unknown>) : null
}

/**
 * True when the address must not be emailed.
 *
 * Throws on a query error rather than returning false — a suppression check
 * that fails open would email people who opted out, so callers must treat an
 * unavailable list as "do not send".
 */
export async function isSalesEmailSuppressed(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const email_address = normalizeEmailForSuppression(email)
  if (!email_address) return true

  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('email_address', email_address)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data != null
}

/** Suppressed subset of the given addresses — for filtering batches cheaply. */
export async function listSuppressedAddresses(
  supabase: SupabaseClient,
  emails: string[],
): Promise<Set<string>> {
  const normalized = [...new Set(emails.map(normalizeEmailForSuppression).filter(Boolean))]
  if (normalized.length === 0) return new Set()

  const { data, error } = await supabase
    .from(TABLE)
    .select('email_address')
    .in('email_address', normalized)

  if (error) throw error
  return new Set((data ?? []).map((row) => String((row as { email_address: unknown }).email_address)))
}

export async function listSalesEmailSuppressions(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<SalesEmailSuppression[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 200)

  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
