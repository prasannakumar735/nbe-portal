import type { SupabaseClient } from '@supabase/supabase-js'
import { generateProposalPdf } from '@/lib/pdf/generateProposalPdf'
import { generatePvcJobCardPdf } from '@/lib/pdf/generatePvcJobCardPdf'
import { sendPvcInvoiceRequestEmail } from '@/lib/email/sendPvcInvoiceRequestEmail'
import { parsePVCCalculatorSnapshot } from '@/lib/pvc/pvcCalculatorSnapshot'
import { snapshotToQuoteData } from '@/lib/pvc/snapshotToQuoteData'
import {
  appendWorkflowHistory,
  type PvcInvoiceStatus,
  type PvcJobSupplyScope,
  type PvcWorkflowClosedStatus,
  PVC_INVOICE_STATUSES,
  PVC_JOB_SUPPLY_SCOPES,
  PVC_WORKFLOW_CLOSED_STATUSES,
  isPvcPreApprovalStatus,
  parseWorkflowHistory,
} from '@/lib/pvc/pvcQuoteWorkflow'

export type PvcQuoteRow = Record<string, unknown>

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

export function exportWorkflowFields(row: PvcQuoteRow, assigneeName?: string | null) {
  return {
    workflow_status: (row.workflow_status as string) ?? 'draft_review',
    approval_po_reference: (row.approval_po_reference as string) ?? null,
    approval_message: (row.approval_message as string) ?? null,
    approved_at: row.approved_at ?? null,
    approved_by: row.approved_by ?? null,
    shipped_or_installed_at: row.shipped_or_installed_at ?? null,
    shipped_or_installed_by: row.shipped_or_installed_by ?? null,
    invoice_status: (row.invoice_status as string) ?? null,
    invoice_status_at: row.invoice_status_at ?? null,
    assigned_user_id: row.assigned_user_id ?? null,
    assigned_user_name: assigneeName ?? null,
    job_card_headrail_length_mm: row.job_card_headrail_length_mm ?? null,
    job_card_supply_scope: (row.job_card_supply_scope as string) ?? null,
    job_card_created_at: row.job_card_created_at ?? null,
    workflow_history: parseWorkflowHistory(row.workflow_history),
  }
}

type ApproveInput = {
  approval_po_reference: string
  approval_message: string
  assigned_user_id: string
  job_card_headrail_length_mm: number | null
  job_card_supply_scope: PvcJobSupplyScope
}

export async function approvePvcQuote(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  input: ApproveInput,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'draft_review' && String(row.workflow_status) !== 'on_hold') {
    throw new Error('Only quotes in draft review or on hold can be approved.')
  }

  const po = input.approval_po_reference.trim()
  const msg = input.approval_message.trim()
  if (!po && !msg) {
    throw new Error('Enter a PO/reference or approval message.')
  }
  if (!input.assigned_user_id) {
    throw new Error('Assign the job card to a team member.')
  }
  if (!PVC_JOB_SUPPLY_SCOPES.includes(input.job_card_supply_scope)) {
    throw new Error('Choose Strips only or Whole door.')
  }

  let headrailMm: number | null = null
  if (input.job_card_supply_scope === 'whole_door') {
    if (!Number.isFinite(input.job_card_headrail_length_mm) || input.job_card_headrail_length_mm! <= 0) {
      throw new Error('Headrail length (mm) is required for whole door supply.')
    }
    headrailMm = input.job_card_headrail_length_mm
  }

  const history = appendWorkflowHistory(row.workflow_history, {
    status: 'approved',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: po || msg,
  })

  const { error } = await supabase
    .from('pvc_quotes')
    .update({
      workflow_status: 'approved',
      approval_po_reference: po || null,
      approval_message: msg || null,
      approved_at: new Date().toISOString(),
      approved_by: actorId,
      assigned_user_id: input.assigned_user_id,
      job_card_headrail_length_mm: headrailMm,
      job_card_supply_scope: input.job_card_supply_scope,
      job_card_created_at: new Date().toISOString(),
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function closePvcQuoteFromDraft(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  outcome: PvcWorkflowClosedStatus,
  closureNote?: string,
): Promise<void> {
  if (!PVC_WORKFLOW_CLOSED_STATUSES.includes(outcome)) {
    throw new Error('Invalid close outcome.')
  }

  const { data: row, error: loadErr } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (!isPvcPreApprovalStatus(String(row.workflow_status))) {
    throw new Error('Reject or close is only available while the quote is in draft or on hold.')
  }

  const note = String(closureNote ?? '').trim()
  const history = appendWorkflowHistory(row.workflow_history, {
    status: outcome,
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: note || null,
  })

  const { error } = await supabase
    .from('pvc_quotes')
    .update({
      workflow_status: outcome,
      approval_message: note || null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function setPvcQuoteOnHold(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  note?: string,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'draft_review') {
    throw new Error('Only draft quotes can be put on hold.')
  }

  const trimmed = String(note ?? '').trim()
  const history = appendWorkflowHistory(row.workflow_history, {
    status: 'on_hold',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: trimmed || null,
  })

  const { error } = await supabase
    .from('pvc_quotes')
    .update({
      workflow_status: 'on_hold',
      approval_message: trimmed || (row.approval_message as string | null) || null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function resumePvcQuoteFromHold(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'on_hold') {
    throw new Error('Only on-hold quotes can return to draft.')
  }

  const history = appendWorkflowHistory(row.workflow_history, {
    status: 'draft_review',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: 'Returned to draft',
  })

  const { error } = await supabase
    .from('pvc_quotes')
    .update({
      workflow_status: 'draft_review',
      draft_follow_up_notified_at: null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function markPvcQuoteShippedOrInstalled(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const { data: row, error: loadErr } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'approved') {
    throw new Error('Quote must be Approved / accepted by client before marking shipped or installed.')
  }

  const history = appendWorkflowHistory(row.workflow_history, {
    status: 'shipped_or_installed',
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: null,
  })

  const { error } = await supabase
    .from('pvc_quotes')
    .update({
      workflow_status: 'shipped_or_installed',
      shipped_or_installed_at: new Date().toISOString(),
      shipped_or_installed_by: actorId,
      invoice_status: null,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error
}

export async function setPvcQuoteInvoiceStatus(
  supabase: SupabaseClient,
  quoteId: string,
  actorId: string,
  actorName: string,
  invoiceStatus: PvcInvoiceStatus,
): Promise<void> {
  if (!PVC_INVOICE_STATUSES.includes(invoiceStatus)) {
    throw new Error('Invalid invoice status.')
  }

  const { data: row, error: loadErr } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (loadErr) throw loadErr
  if (!row) throw new Error('Quote not found.')
  if (String(row.workflow_status) !== 'shipped_or_installed') {
    throw new Error('Set invoice status after the order is shipped or installed.')
  }

  const history = appendWorkflowHistory(row.workflow_history, {
    status: `invoice:${invoiceStatus}`,
    at: new Date().toISOString(),
    by_user_id: actorId,
    by_name: actorName,
    note: null,
  })

  const { error } = await supabase
    .from('pvc_quotes')
    .update({
      invoice_status: invoiceStatus,
      invoice_status_at: new Date().toISOString(),
      invoice_status_by: actorId,
      workflow_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)

  if (error) throw error

  if (invoiceStatus === 'not_invoiced') {
    const snapshot = parsePVCCalculatorSnapshot(row.form_snapshot)
    const quoteData = snapshotToQuoteData(snapshot)
    const pdfBytes = await generateProposalPdf(quoteData)
    const fileName = `PVC_Quote_${quoteId.slice(0, 8)}.pdf`
    await sendPvcInvoiceRequestEmail({
      managerDisplayName: actorName,
      quoteData,
      pdfBuffer: pdfBytes,
      fileName,
      customerLabel: String(row.customer_name ?? quoteData.customerDetails?.customer ?? 'Customer'),
    })
  }
}

export async function buildJobCardPdfForQuote(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<Uint8Array> {
  const { data: row, error } = await supabase.from('pvc_quotes').select('*').eq('id', quoteId).maybeSingle()
  if (error) throw error
  if (!row) throw new Error('Quote not found.')
  if (!row.form_snapshot) throw new Error('No saved calculator data for this quote.')

  const snapshot = parsePVCCalculatorSnapshot(row.form_snapshot)
  const quoteData = snapshotToQuoteData(snapshot)
  const assigneeName = await profileDisplayName(supabase, String(row.assigned_user_id ?? ''))
  const headrailLen =
    row.job_card_headrail_length_mm != null ? Number(row.job_card_headrail_length_mm) : null
  const scope = String(row.job_card_supply_scope ?? '') as PvcJobSupplyScope
  if (scope === 'whole_door') {
    if (!Number.isFinite(headrailLen) || headrailLen! <= 0) {
      throw new Error('Job card headrail length is not set.')
    }
  }
  if (!PVC_JOB_SUPPLY_SCOPES.includes(scope)) {
    throw new Error('Job card supply scope is not set.')
  }

  return generatePvcJobCardPdf({
    quoteData,
    headrailLengthMm: headrailLen,
    supplyScope: scope,
    assignedToName: assigneeName,
    poReference: row.approval_po_reference as string | null,
    approvalMessage: row.approval_message as string | null,
  })
}

/** Quotes approved but not yet shipped/installed (for manager reminders). */
export async function listPvcQuotesPendingShipment(
  supabase: SupabaseClient,
  olderThanDays = 3,
): Promise<{ id: string; customer_name: string | null; approved_at: string | null }[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const { data, error } = await supabase
    .from('pvc_quotes')
    .select('id, customer_name, approved_at')
    .eq('workflow_status', 'approved')
    .lt('approved_at', cutoff.toISOString())
    .order('approved_at', { ascending: true })
    .limit(50)

  if (error) throw error
  return (data ?? []) as { id: string; customer_name: string | null; approved_at: string | null }[]
}

/** Draft quotes at least N days old that have not had a follow-up email yet. */
export async function listPvcQuotesNeedingDraftFollowUpEmail(
  supabase: SupabaseClient,
  olderThanDays = 2,
): Promise<{ id: string; customer_name: string | null; created_at: string | null }[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const { data, error } = await supabase
    .from('pvc_quotes')
    .select('id, customer_name, created_at')
    .eq('workflow_status', 'draft_review')
    .is('draft_follow_up_notified_at', null)
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) throw error
  return (data ?? []) as { id: string; customer_name: string | null; created_at: string | null }[]
}
