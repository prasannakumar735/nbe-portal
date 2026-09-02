'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  isServiceQuoteClosedStatus,
  isServiceQuotePreApprovalStatus,
  serviceInvoiceStatusLabel,
  serviceWorkflowStatusLabel,
  serviceWorkflowSteps,
  resolveServiceWorkflowStepIndex,
  type ServiceQuoteWorkflowHistoryEntry,
} from '@/lib/quotes/serviceQuoteWorkflow'

export type ServiceQuoteWorkflowState = {
  workflow_status: string
  approval_po_reference: string | null
  approval_message: string | null
  invoice_status: string | null
  invoice_status_at: string | null
  assigned_user_id: string | null
  assigned_user_name: string | null
  approved_at: string | null
  completed_at: string | null
  workflow_history: ServiceQuoteWorkflowHistoryEntry[]
}

type Assignee = { id: string; name: string }

function WorkflowStepper({
  workflowStatus,
  invoiceStatus,
}: {
  workflowStatus: string
  invoiceStatus: string | null
}) {
  const steps = serviceWorkflowSteps()
  const activeIndex = resolveServiceWorkflowStepIndex(workflowStatus, invoiceStatus)

  return (
    <nav aria-label="Workflow progress">
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const state = i < activeIndex ? 'complete' : i === activeIndex ? 'current' : 'upcoming'
          return (
            <li key={step.key} className={`relative flex ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    state === 'complete'
                      ? 'bg-emerald-500 text-white'
                      : state === 'current'
                        ? 'bg-slate-900 text-white'
                        : 'border-2 border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {state === 'complete' ? '✓' : i + 1}
                </div>
                <p className={`mt-1 text-[10px] font-medium ${state === 'current' ? 'text-slate-900' : 'text-slate-400'}`}>
                  {step.shortLabel}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-1 mt-3 h-px flex-1 ${i < activeIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function ServiceQuoteWorkflowPanel({
  quoteId,
  workflow,
  isManager,
  onUpdated,
}: {
  quoteId: string
  workflow: ServiceQuoteWorkflowState | null
  isManager: boolean
  onUpdated?: () => void
}) {
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [poRef, setPoRef] = useState('')
  const [approvalMsg, setApprovalMsg] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [closureNote, setClosureNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isManager) return
    // Reuse the PVC meta endpoint — it returns all assignable team members
    fetch('/api/pvc/quotes/meta')
      .then(r => r.json())
      .then(data => { if (data.assignees) setAssignees(data.assignees) })
      .catch(() => {})
  }, [isManager])

  useEffect(() => {
    if (workflow) {
      setPoRef(workflow.approval_po_reference ?? '')
      setApprovalMsg(workflow.approval_message ?? '')
    }
  }, [workflow])

  const postWorkflow = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true)
      setErr(null)
      setSuccessMsg(null)
      try {
        const res = await fetch(`/api/quotes/service/${quoteId}/workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Update failed.')
        setSuccessMsg('Workflow updated.')
        onUpdated?.()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Update failed.')
      } finally {
        setBusy(false)
      }
    },
    [quoteId, onUpdated],
  )

  if (!workflow) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Workflow not available — run the migration{' '}
        <code className="font-mono text-xs">20260902130000_service_quote_workflow.sql</code> in Supabase.
      </section>
    )
  }

  const status = workflow.workflow_status
  const closed = isServiceQuoteClosedStatus(status)
  const isOnHold = status === 'on_hold'
  const isPreApproval = isServiceQuotePreApprovalStatus(status)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Workflow</h2>

      <div className="mt-3">
        <WorkflowStepper workflowStatus={status} invoiceStatus={workflow.invoice_status} />
      </div>

      {closed && (
        <div className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          {serviceWorkflowStatusLabel(status)}
          {workflow.approval_message ? ` — ${workflow.approval_message}` : ''}
        </div>
      )}

      {status === 'approved' && workflow.assigned_user_name && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Assigned to</dt>
            <dd className="font-medium text-slate-900">{workflow.assigned_user_name}</dd>
          </div>
          {workflow.approval_po_reference && (
            <div>
              <dt className="text-slate-500">PO / reference</dt>
              <dd className="font-medium text-slate-900">{workflow.approval_po_reference}</dd>
            </div>
          )}
          {workflow.approved_at && (
            <div>
              <dt className="text-slate-500">Approved</dt>
              <dd className="text-slate-700">{workflow.approved_at.slice(0, 10)}</dd>
            </div>
          )}
        </dl>
      )}

      {status === 'completed' && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {workflow.completed_at && (
            <div>
              <dt className="text-slate-500">Completed</dt>
              <dd className="text-slate-700">{workflow.completed_at.slice(0, 10)}</dd>
            </div>
          )}
          {workflow.invoice_status && (
            <div>
              <dt className="text-slate-500">Invoice</dt>
              <dd className="font-medium text-slate-900">{serviceInvoiceStatusLabel(workflow.invoice_status)}</dd>
            </div>
          )}
        </dl>
      )}

      {workflow.workflow_history.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</h3>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-600">
            {[...workflow.workflow_history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <span className="font-medium text-slate-800">{serviceWorkflowStatusLabel(h.status)}</span>
                {' · '}
                {String(h.at).slice(0, 16).replace('T', ' ')}
                {h.by_name ? ` · ${h.by_name}` : ''}
                {h.note ? ` — ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {successMsg && <p className="mt-3 text-sm text-emerald-700">{successMsg}</p>}

      {closed ? (
        <p className="mt-4 text-xs text-slate-500">This quote is closed. Create a new quote if needed.</p>
      ) : !isManager ? (
        <p className="mt-4 text-xs text-slate-500">Managers can advance workflow actions.</p>
      ) : (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">

          {/* ── Pre-approval actions ───────────────────────────── */}
          {isPreApproval && (
            <div className="space-y-3">
              {isOnHold && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  On hold while the client considers.
                </div>
              )}
              {isOnHold && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => postWorkflow({ action: 'resume_draft' })}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  Return to draft
                </button>
              )}

              <p className="text-sm font-medium text-slate-800">Approve — accepted by client</p>
              <label className="block text-sm">
                <span className="text-slate-600">PO or reference</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={poRef}
                  onChange={e => setPoRef(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Message / notes</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                  value={approvalMsg}
                  onChange={e => setApprovalMsg(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Assign to team member</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {assignees.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  postWorkflow({
                    action: 'approve',
                    approval_po_reference: poRef,
                    approval_message: approvalMsg,
                    assigned_user_id: assigneeId,
                  })
                }
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Approve & assign
              </button>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                {!isOnHold && (
                  <>
                    <p className="text-sm font-medium text-slate-800">Client needs more time?</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => postWorkflow({ action: 'put_on_hold', closure_note: closureNote })}
                      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Put on hold
                    </button>
                  </>
                )}
                <p className="text-sm font-medium text-slate-800">Close without approving</p>
                <label className="block text-sm">
                  <span className="text-slate-600">Reason / notes (optional)</span>
                  <textarea
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                    value={closureNote}
                    onChange={e => setClosureNote(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => postWorkflow({ action: 'reject', closure_note: closureNote })}
                    className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-60"
                  >
                    Mark rejected
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => postWorkflow({ action: 'void', closure_note: closureNote })}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Close — not pursuing
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Approved: mark completed ───────────────────────── */}
          {status === 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postWorkflow({ action: 'mark_completed' })}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Mark service completed
            </button>
          )}

          {/* ── Completed: invoice status ──────────────────────── */}
          {status === 'completed' && !workflow.invoice_status && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">Update invoice status</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => postWorkflow({ action: 'set_invoice', invoice_status: 'invoiced' })}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                >
                  Invoiced
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => postWorkflow({ action: 'set_invoice', invoice_status: 'not_invoiced' })}
                  className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  Not invoiced
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
