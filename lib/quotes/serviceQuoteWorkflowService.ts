import type { SupabaseClient } from '@supabase/supabase-js'
import {
  appendServiceWorkflowHistory,
  isServiceQuoteClosedStatus,
  isServiceQuotePreApprovalStatus,
  parseServiceWorkflowHistory,
  type ServiceQuoteClosedStatus,
  type ServiceQuoteInvoiceStatus,
  SERVICE_QUOTE_CLOSED_STATUSES,
  SERVICE_QUOTE_INVOICE_STATUSES,
} from '@/lib/quotes/serviceQuoteWorkflow'

export type ServiceQuoteRow = Record<string, unknown>

export async function profileDisplayName(supabase: SupabaseClient, userId: string | null): Promise<string> {
  if (!userId) return 'Unknown'
  const { data } = await supabase
    .from('profiles')
    .select('full_name, first_name, last_name')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return 'Unknown'
  const full = String(data.full_name ?? '').trim()
  if (full) return full
  const parts = [data.first_name, data.last_name].filter(Boolean).map(String)
  return parts.join(' ').trim() || 'Unknown'
}

export function exportServiceWorkflowFields(row: ServiceQuoteRow, assigneeName?: string | null) {
  return {
    workflow_status: (row.workflow_status as string) ?? 'draft_review',
    approval_po_reference: (row.approval_po_reference as string) ?? null,
    approval_message: (row.approval_message as string) ?? null,
    approved_at: row.approved_at ?? null,
    approved_by: row.approved_by ?? null,
    completed_at: row.completed_at ?? null,
    completed_by: row.completed_by ?? null,
    invoice_status: (row.invoice_status as string) ?? null,
    invoice_status_at: row.invoice_status_at ?? null,
    assigned_user_id: row.assigned_user_id ?? null,
    assigned_user_name: assigneeName ?? null,
    workflow_history: parseServiceWorkflowHistory(row.workflow_history),
  }
}

export async function approveServiceQuote(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  input: { approval_po_reference: string; approval_message: string; assigned_user_id: string },
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  const ws = String(row.workflow_status ?? 'draft_review')
  if (ws !== 'draft_review' && ws !== 'on_hold') {
    throw new Error('Only quotes in draft review or on hold can be approved.')
  }

  const po = input.approval_po_reference.trim()
  const msg = input.approval_message.trim()
  if (!po && !msg) throw new Error('Enter a PO/reference or approval message.')
  if (!input.assigned_user_id) throw new Error('Assign the job to a team member.')

  const history = appendServiceWorkflowHistory(row.workflow_history, {
    status: 'approved',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: po || msg,
  })

  const { error } = await supabase
    .from('quotes')
    .update({
      workflow_status: 'approved',
      approval_po_reference: po || null,
      approval_message: msg || null,
      approved_at: new Date().toISOString(),
      approved_by: actorId,
      assigned_user_id: input.assigned_user_id,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function closeServiceQuoteFromDraft(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  outcome: ServiceQuoteClosedStatus,
  closureNote?: string,
): Promise<void> {
  if (!SERVICE_QUOTE_CLOSED_STATUSES.includes(outcome)) throw new Error('Invalid close outcome.')

  const { data: row, error: loadErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (!isServiceQuotePreApprovalStatus(String(row.workflow_status))) {
    throw new Error('Reject or close is only available while the quote is in draft or on hold.')
  }

  const note = String(closureNote ?? '').trim()
  const history = appendServiceWorkflowHistory(row.workflow_history, {
    status: outcome,
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: note || null,
  })

  const { error } = await supabase
    .from('quotes')
    .update({
      workflow_status: outcome,
      approval_message: note || null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function setServiceQuoteOnHold(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  note?: string,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status ?? 'draft_review') !== 'draft_review') {
    throw new Error('Only draft quotes can be put on hold.')
  }

  const trimmed = String(note ?? '').trim()
  const history = appendServiceWorkflowHistory(row.workflow_history, {
    status: 'on_hold',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: trimmed || null,
  })

  const { error } = await supabase
    .from('quotes')
    .update({
      workflow_status: 'on_hold',
      approval_message: trimmed || (row.approval_message as string | null) || null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function resumeServiceQuoteFromHold(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'on_hold') throw new Error('Only on-hold quotes can return to draft.')

  const history = appendServiceWorkflowHistory(row.workflow_history, {
    status: 'draft_review',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: 'Returned to draft',
  })

  const { error } = await supabase
    .from('quotes')
    .update({
      workflow_status: 'draft_review',
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function markServiceQuoteCompleted(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'approved') {
    throw new Error('Quote must be approved before marking as completed.')
  }

  const history = appendServiceWorkflowHistory(row.workflow_history, {
    status: 'completed',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: null,
  })

  const { error } = await supabase
    .from('quotes')
    .update({
      workflow_status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: actorId,
      invoice_status: null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function setServiceQuoteInvoiceStatus(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  invoiceStatus: ServiceQuoteInvoiceStatus,
): Promise<void> {
  if (!SERVICE_QUOTE_INVOICE_STATUSES.includes(invoiceStatus)) throw new Error('Invalid invoice status.')

  const { data: row, error: loadErr } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'completed') {
    throw new Error('Set invoice status after the service is completed.')
  }

  const history = appendServiceWorkflowHistory(row.workflow_history, {
    status: `invoice:${invoiceStatus}`,
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: null,
  })

  const { error } = await supabase
    .from('quotes')
    .update({
      invoice_status: invoiceStatus,
      invoice_status_at: new Date().toISOString(),
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function listServiceQuotesPendingCompletion(
  supabase: SupabaseClient,
  olderThanDays = 3,
): Promise<{ id: string; customer_name: string | null; approved_at: string | null }[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const { data, error } = await supabase
    .from('quotes')
    .select('id, customer_name, approved_at')
    .eq('workflow_status', 'approved')
    .lt('approved_at', cutoff.toISOString())
    .order('approved_at', { ascending: true })
    .limit(50)

  if (error) throw error
  return (data ?? []) as { id: string; customer_name: string | null; approved_at: string | null }[]
}

/** Checks whether a quotes row has the workflow columns (migration ran). */
export function serviceQuoteHasWorkflow(row: ServiceQuoteRow): boolean {
  return 'workflow_status' in row
}

/** Guard: only quotes of service/repair/parts types (not rapid_door) use this workflow. */
export function isServiceWorkflowEligible(row: ServiceQuoteRow): boolean {
  return row.quote_kind !== 'rapid_door'
}
