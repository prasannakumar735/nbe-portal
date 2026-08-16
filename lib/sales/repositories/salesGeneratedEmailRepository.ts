import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesGeneratedEmail,
  SalesGeneratedEmailInsert,
  SalesGeneratedEmailReviewPatch,
  SalesGeneratedEmailUpdate,
} from '@/lib/sales/types/generatedEmail.types'
import type { SalesGeneratedEmailStatus } from '@/lib/sales/constants/generatedEmailStatuses'

const TABLE = 'sales_generated_emails'

export class SalesGeneratedEmailReviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesGeneratedEmailReviewError'
  }
}

function mapRow(row: Record<string, unknown>): SalesGeneratedEmail {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    subject: String(row.subject),
    body: String(row.body),
    generation_provider: String(row.generation_provider),
    status: row.status as SalesGeneratedEmailStatus,
    version: Number(row.version ?? 1),
    parent_generated_email_id:
      row.parent_generated_email_id != null ? String(row.parent_generated_email_id) : null,
    thread_root_email_id:
      row.thread_root_email_id != null ? String(row.thread_root_email_id) : null,
    sequence_position: Number(row.sequence_position ?? 0),
    prompt_library_id:
      row.prompt_library_id != null ? String(row.prompt_library_id) : null,
    prompt_name: row.prompt_name != null ? String(row.prompt_name) : null,
    prompt_version: row.prompt_version != null ? Number(row.prompt_version) : null,
    reviewed_by: row.reviewed_by != null ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    created_at: String(row.created_at),
  }
}

const REVIEWABLE_FOR_APPROVE: SalesGeneratedEmailStatus[] = ['draft', 'edited']

function assertCanApprove(status: SalesGeneratedEmailStatus): void {
  if (status === 'sent') {
    throw new SalesGeneratedEmailReviewError('Cannot approve an email that has already been sent.')
  }
  if (status === 'rejected') {
    throw new SalesGeneratedEmailReviewError('Cannot approve a rejected email.')
  }
  if (status === 'queued') {
    throw new SalesGeneratedEmailReviewError('Cannot approve an email that is already queued for sending.')
  }
  if (status === 'approved') {
    throw new SalesGeneratedEmailReviewError('Email is already approved.')
  }
  if (!REVIEWABLE_FOR_APPROVE.includes(status)) {
    throw new SalesGeneratedEmailReviewError('Only draft or edited emails can be approved.')
  }
}

function assertCanReject(status: SalesGeneratedEmailStatus): void {
  if (status === 'sent') {
    throw new SalesGeneratedEmailReviewError('Cannot reject an email that has already been sent.')
  }
  if (status === 'queued') {
    throw new SalesGeneratedEmailReviewError('Cannot reject an email that is already queued for sending.')
  }
  if (status === 'rejected') {
    throw new SalesGeneratedEmailReviewError('Email is already rejected.')
  }
  if (!REVIEWABLE_FOR_APPROVE.includes(status)) {
    throw new SalesGeneratedEmailReviewError('Only draft or edited emails can be rejected.')
  }
}

function assertCanEdit(status: SalesGeneratedEmailStatus): void {
  if (status === 'sent') {
    throw new SalesGeneratedEmailReviewError('Cannot edit an email that has already been sent.')
  }
}

export async function listSalesGeneratedEmailsByCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  options?: { contactId?: string; status?: SalesGeneratedEmailStatus },
): Promise<SalesGeneratedEmail[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('campaign_id', campaignId)
    .order('contact_id', { ascending: true })
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })

  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

/** One row per contact (highest version) for campaign review UI. */
export async function listLatestSalesGeneratedEmailsByCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  options?: { status?: SalesGeneratedEmailStatus },
): Promise<SalesGeneratedEmail[]> {
  const rows = await listSalesGeneratedEmailsByCampaign(supabase, campaignId, {
    status: options?.status,
  })
  const latestByContact = new Map<string, SalesGeneratedEmail>()
  for (const row of rows) {
    const existing = latestByContact.get(row.contact_id)
    if (!existing || row.version > existing.version) {
      latestByContact.set(row.contact_id, row)
    }
  }
  return [...latestByContact.values()].sort((a, b) =>
    a.contact_id.localeCompare(b.contact_id),
  )
}

/** Regeneration / audit history for one campaign contact (newest version first). */
export async function listSalesGeneratedEmailHistory(
  supabase: SupabaseClient,
  campaignId: string,
  contactId: string,
): Promise<SalesGeneratedEmail[]> {
  return listSalesGeneratedEmailsByCampaign(supabase, campaignId, { contactId })
}

export async function getSalesGeneratedEmailById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGeneratedEmail | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

/** Latest version row for a campaign contact (Phase 5 review UI). */
export async function getLatestSalesGeneratedEmailForContact(
  supabase: SupabaseClient,
  campaignId: string,
  contactId: string,
): Promise<SalesGeneratedEmail | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

/** Next version number when regenerating for the same campaign + contact. */
export async function getNextSalesGeneratedEmailVersion(
  supabase: SupabaseClient,
  options: { campaignId: string; contactId: string },
): Promise<number> {
  const latest = await getLatestSalesGeneratedEmailForContact(
    supabase,
    options.campaignId,
    options.contactId,
  )
  return latest ? latest.version + 1 : 1
}

export async function createSalesGeneratedEmail(
  supabase: SupabaseClient,
  row: SalesGeneratedEmailInsert,
): Promise<SalesGeneratedEmail> {
  const insertRow: Record<string, unknown> = {
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      subject: row.subject,
      body: row.body,
      generation_provider: row.generation_provider,
      status: row.status ?? 'draft',
      version: row.version ?? 1,
    }
  if (row.parent_generated_email_id !== undefined) {
    insertRow.parent_generated_email_id = row.parent_generated_email_id
  }
  if (row.thread_root_email_id !== undefined) {
    insertRow.thread_root_email_id = row.thread_root_email_id
  }
  if (row.sequence_position !== undefined) {
    insertRow.sequence_position = row.sequence_position
  }
  if (row.prompt_name !== undefined) insertRow.prompt_name = row.prompt_name
  if (row.prompt_version !== undefined) insertRow.prompt_version = row.prompt_version
  if (row.prompt_library_id !== undefined) insertRow.prompt_library_id = row.prompt_library_id

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insertRow)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesGeneratedEmail(
  supabase: SupabaseClient,
  id: string,
  patch: SalesGeneratedEmailUpdate,
): Promise<SalesGeneratedEmail> {
  const payload: Record<string, unknown> = {}
  if (patch.subject != null) payload.subject = patch.subject
  if (patch.body != null) payload.body = patch.body
  if (patch.status != null) payload.status = patch.status

  if (Object.keys(payload).length === 0) {
    const existing = await getSalesGeneratedEmailById(supabase, id)
    if (!existing) throw new Error('Generated email not found.')
    return existing
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Generated email not found.')
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesGeneratedEmailQueued(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGeneratedEmail> {
  const existing = await getSalesGeneratedEmailById(supabase, id)
  if (!existing) throw new SalesGeneratedEmailReviewError('Generated email not found.')
  if (existing.status !== 'approved') {
    throw new SalesGeneratedEmailReviewError('Only approved emails can enter the send queue.')
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'queued' })
    .eq('id', id)
    .eq('status', 'approved')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new SalesGeneratedEmailReviewError('Generated email could not be queued (status changed).')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesGeneratedEmailSent(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesGeneratedEmail> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'sent' })
    .eq('id', id)
    .in('status', ['queued', 'approved', 'edited'])
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesGeneratedEmailReviewError('Generated email could not be marked sent.')
  return mapRow(data as Record<string, unknown>)
}

export async function approveSalesGeneratedEmail(
  supabase: SupabaseClient,
  id: string,
  reviewedBy: string,
): Promise<SalesGeneratedEmail> {
  const existing = await getSalesGeneratedEmailById(supabase, id)
  if (!existing) throw new SalesGeneratedEmailReviewError('Generated email not found.')
  assertCanApprove(existing.status)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: now,
    })
    .eq('id', id)
    .in('status', REVIEWABLE_FOR_APPROVE)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new SalesGeneratedEmailReviewError('Generated email could not be approved (status changed).')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function rejectSalesGeneratedEmail(
  supabase: SupabaseClient,
  id: string,
  reviewedBy: string,
): Promise<SalesGeneratedEmail> {
  const existing = await getSalesGeneratedEmailById(supabase, id)
  if (!existing) throw new SalesGeneratedEmailReviewError('Generated email not found.')
  assertCanReject(existing.status)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: now,
    })
    .eq('id', id)
    .in('status', REVIEWABLE_FOR_APPROVE)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new SalesGeneratedEmailReviewError('Generated email could not be rejected (status changed).')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function editSalesGeneratedEmail(
  supabase: SupabaseClient,
  id: string,
  patch: SalesGeneratedEmailReviewPatch,
): Promise<SalesGeneratedEmail> {
  const existing = await getSalesGeneratedEmailById(supabase, id)
  if (!existing) throw new SalesGeneratedEmailReviewError('Generated email not found.')
  assertCanEdit(existing.status)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      subject: patch.subject,
      body: patch.body,
      status: 'edited',
      updated_at: now,
    })
    .eq('id', id)
    .neq('status', 'sent')
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new SalesGeneratedEmailReviewError('Generated email could not be edited.')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function bulkApproveSalesGeneratedEmails(
  supabase: SupabaseClient,
  emailIds: string[],
  reviewedBy: string,
): Promise<{ succeeded: SalesGeneratedEmail[]; failed: { id: string; reason: string }[] }> {
  const succeeded: SalesGeneratedEmail[] = []
  const failed: { id: string; reason: string }[] = []

  for (const id of emailIds) {
    try {
      succeeded.push(await approveSalesGeneratedEmail(supabase, id, reviewedBy))
    } catch (error) {
      failed.push({
        id,
        reason: error instanceof Error ? error.message : 'Approve failed.',
      })
    }
  }

  return { succeeded, failed }
}

export async function bulkRejectSalesGeneratedEmails(
  supabase: SupabaseClient,
  emailIds: string[],
  reviewedBy: string,
): Promise<{ succeeded: SalesGeneratedEmail[]; failed: { id: string; reason: string }[] }> {
  const succeeded: SalesGeneratedEmail[] = []
  const failed: { id: string; reason: string }[] = []

  for (const id of emailIds) {
    try {
      succeeded.push(await rejectSalesGeneratedEmail(supabase, id, reviewedBy))
    } catch (error) {
      failed.push({
        id,
        reason: error instanceof Error ? error.message : 'Reject failed.',
      })
    }
  }

  return { succeeded, failed }
}

/** @alias approveSalesGeneratedEmail */
export const approve = approveSalesGeneratedEmail

/** @alias rejectSalesGeneratedEmail */
export const reject = rejectSalesGeneratedEmail

/** @alias editSalesGeneratedEmail */
export const edit = editSalesGeneratedEmail

/** @alias bulkApproveSalesGeneratedEmails */
export const bulkApprove = bulkApproveSalesGeneratedEmails

/** @alias bulkRejectSalesGeneratedEmails */
export const bulkReject = bulkRejectSalesGeneratedEmails
