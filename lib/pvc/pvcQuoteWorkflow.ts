export const PVC_WORKFLOW_STATUSES = [
  'draft_review',
  'approved',
  'shipped_or_installed',
] as const

export type PvcWorkflowStatus = (typeof PVC_WORKFLOW_STATUSES)[number]

/** Terminal outcomes available from draft (not part of the fulfilment pipeline). */
export const PVC_WORKFLOW_CLOSED_STATUSES = ['rejected', 'void'] as const
export type PvcWorkflowClosedStatus = (typeof PVC_WORKFLOW_CLOSED_STATUSES)[number]

export const PVC_INVOICE_STATUSES = ['invoiced', 'not_invoiced'] as const
export type PvcInvoiceStatus = (typeof PVC_INVOICE_STATUSES)[number]

export const PVC_JOB_SUPPLY_SCOPES = ['strips_only', 'whole_door'] as const
export type PvcJobSupplyScope = (typeof PVC_JOB_SUPPLY_SCOPES)[number]

export type PvcWorkflowHistoryEntry = {
  status: string
  at: string
  by_user_id: string | null
  by_name?: string | null
  note?: string | null
}

export function isPvcWorkflowStatus(value: string): value is PvcWorkflowStatus {
  return (PVC_WORKFLOW_STATUSES as readonly string[]).includes(value)
}

export function isPvcWorkflowClosedStatus(value: string | null | undefined): value is PvcWorkflowClosedStatus {
  return (PVC_WORKFLOW_CLOSED_STATUSES as readonly string[]).includes(value ?? '')
}

/** Draft phase: active review or paused while client decides. */
export function isPvcPreApprovalStatus(value: string | null | undefined): boolean {
  const s = value ?? 'draft_review'
  return s === 'draft_review' || s === 'on_hold'
}

export function workflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'draft_review':
      return 'Draft — initial review'
    case 'on_hold':
      return 'On hold — client considering'
    case 'approved':
      return 'Approved — accepted by client'
    case 'shipped_or_installed':
      return 'Shipped or installed'
    case 'invoicing':
      return 'Invoicing'
    case 'rejected':
      return 'Rejected — quote not accepted'
    case 'void':
      return 'Closed — not pursuing'
    default:
      return status?.replace(/_/g, ' ') ?? '—'
  }
}

export type PvcWorkflowStepDef = {
  key: string
  shortLabel: string
  description: string
}

export function resolveActiveWorkflowStepIndex(
  workflowStatus: string | null | undefined,
  invoiceStatus: string | null | undefined,
): number {
  const status = workflowStatus ?? 'draft_review'
  if (isPvcWorkflowClosedStatus(status)) return 0
  if (status === 'on_hold') return 0
  if (status === 'approved') return 1
  if (status === 'shipped_or_installed') {
    return invoiceStatus ? 3 : 2
  }
  if (status === 'draft_review') return 0
  return 0
}

export function workflowStepState(
  stepIndex: number,
  activeIndex: number,
): 'complete' | 'current' | 'upcoming' {
  if (stepIndex < activeIndex) return 'complete'
  if (stepIndex === activeIndex) return 'current'
  return 'upcoming'
}

export function invoiceStatusLabel(status: string | null | undefined): string {
  if (status === 'invoiced') return 'Invoiced'
  if (status === 'not_invoiced') return 'Not invoiced'
  return '—'
}

export function supplyScopeLabel(scope: string | null | undefined): string {
  if (scope === 'strips_only') return 'Strips only'
  if (scope === 'whole_door') return 'Whole door'
  return '—'
}

export function workflowSteps(): PvcWorkflowStepDef[] {
  return [
    { key: 'draft_review', shortLabel: 'Draft', description: 'Initial review' },
    { key: 'approved', shortLabel: 'Approved', description: 'Accepted by client' },
    { key: 'shipped_or_installed', shortLabel: 'Shipped', description: 'Shipped or installed' },
    { key: 'invoicing', shortLabel: 'Invoicing', description: 'Invoiced or not invoiced' },
  ]
}

/** Pause while the client needs more time (from draft). */
export function workflowDraftOnHoldOption(): PvcWorkflowStepDef {
  return { key: 'on_hold', shortLabel: 'On hold', description: 'Client needs more time' }
}

/** Alternate outcomes from draft (not sequential with approval path). */
export function workflowDraftCloseOptions(): PvcWorkflowStepDef[] {
  return [
    { key: 'rejected', shortLabel: 'Rejected', description: 'Quote not accepted' },
    { key: 'void', shortLabel: 'Closed', description: 'Client not pursuing' },
  ]
}

export function appendWorkflowHistory(
  existing: unknown,
  entry: PvcWorkflowHistoryEntry,
): PvcWorkflowHistoryEntry[] {
  const list = Array.isArray(existing) ? [...(existing as PvcWorkflowHistoryEntry[])] : []
  list.push(entry)
  return list
}

export function parseWorkflowHistory(value: unknown): PvcWorkflowHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is PvcWorkflowHistoryEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as PvcWorkflowHistoryEntry).status === 'string' &&
      typeof (e as PvcWorkflowHistoryEntry).at === 'string',
  )
}
