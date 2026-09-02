export const SERVICE_QUOTE_WORKFLOW_STATUSES = [
  'draft_review',
  'approved',
  'completed',
] as const

export type ServiceQuoteWorkflowStatus = (typeof SERVICE_QUOTE_WORKFLOW_STATUSES)[number]

export const SERVICE_QUOTE_CLOSED_STATUSES = ['rejected', 'void'] as const
export type ServiceQuoteClosedStatus = (typeof SERVICE_QUOTE_CLOSED_STATUSES)[number]

export const SERVICE_QUOTE_INVOICE_STATUSES = ['invoiced', 'not_invoiced'] as const
export type ServiceQuoteInvoiceStatus = (typeof SERVICE_QUOTE_INVOICE_STATUSES)[number]

export type ServiceQuoteWorkflowHistoryEntry = {
  status: string
  at: string
  by_user_id: string | null
  by_name?: string | null
  note?: string | null
}

export function isServiceQuoteClosedStatus(value: string | null | undefined): value is ServiceQuoteClosedStatus {
  return (SERVICE_QUOTE_CLOSED_STATUSES as readonly string[]).includes(value ?? '')
}

export function isServiceQuotePreApprovalStatus(value: string | null | undefined): boolean {
  const s = value ?? 'draft_review'
  return s === 'draft_review' || s === 'on_hold'
}

export function serviceWorkflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'draft_review': return 'Draft — initial review'
    case 'on_hold': return 'On hold — client considering'
    case 'approved': return 'Approved — accepted by client'
    case 'completed': return 'Completed — service done'
    case 'rejected': return 'Rejected — quote not accepted'
    case 'void': return 'Closed — not pursuing'
    default: return status?.replace(/_/g, ' ') ?? '—'
  }
}

export function serviceInvoiceStatusLabel(status: string | null | undefined): string {
  if (status === 'invoiced') return 'Invoiced'
  if (status === 'not_invoiced') return 'Not invoiced'
  return '—'
}

export type ServiceWorkflowStepDef = {
  key: string
  shortLabel: string
  description: string
}

export function serviceWorkflowSteps(): ServiceWorkflowStepDef[] {
  return [
    { key: 'draft_review', shortLabel: 'Draft', description: 'Initial review' },
    { key: 'approved', shortLabel: 'Approved', description: 'Accepted by client' },
    { key: 'completed', shortLabel: 'Completed', description: 'Service done' },
    { key: 'invoicing', shortLabel: 'Invoicing', description: 'Invoiced or not invoiced' },
  ]
}

export function resolveServiceWorkflowStepIndex(
  workflowStatus: string | null | undefined,
  invoiceStatus: string | null | undefined,
): number {
  const s = workflowStatus ?? 'draft_review'
  if (isServiceQuoteClosedStatus(s) || s === 'on_hold') return 0
  if (s === 'draft_review') return 0
  if (s === 'approved') return 1
  if (s === 'completed') return invoiceStatus ? 3 : 2
  return 0
}

export function appendServiceWorkflowHistory(
  existing: unknown,
  entry: ServiceQuoteWorkflowHistoryEntry,
): ServiceQuoteWorkflowHistoryEntry[] {
  const list = Array.isArray(existing) ? [...(existing as ServiceQuoteWorkflowHistoryEntry[])] : []
  list.push(entry)
  return list
}

export function parseServiceWorkflowHistory(value: unknown): ServiceQuoteWorkflowHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is ServiceQuoteWorkflowHistoryEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as ServiceQuoteWorkflowHistoryEntry).status === 'string' &&
      typeof (e as ServiceQuoteWorkflowHistoryEntry).at === 'string',
  )
}
