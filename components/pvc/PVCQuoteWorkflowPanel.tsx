'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  invoiceStatusLabel,
  isPvcWorkflowClosedStatus,
  isPvcPreApprovalStatus,
  supplyScopeLabel,
  workflowStatusLabel,
  type PvcWorkflowHistoryEntry,
} from '@/lib/pvc/pvcQuoteWorkflow'
import { PVCQuoteWorkflowStepper } from '@/components/pvc/PVCQuoteWorkflowStepper'
import type { PvcJobCardDefaults } from '@/lib/pvc/pvcJobCardDefaults'

export type PvcQuoteWorkflowState = {
  workflow_status: string
  approval_po_reference: string | null
  approval_message: string | null
  invoice_status: string | null
  assigned_user_name: string | null
  job_card_headrail_length_mm: number | null
  job_card_supply_scope: string | null
  workflow_history: PvcWorkflowHistoryEntry[]
}

type Assignee = { id: string; name: string }

export function PVCQuoteWorkflowPanel({
  quoteId,
  workflow,
  isManager,
  onUpdated,
  showStepper = true,
  jobCardDefaults = null,
}: {
  quoteId: string
  workflow: PvcQuoteWorkflowState | null
  isManager: boolean
  onUpdated?: () => void
  showStepper?: boolean
  jobCardDefaults?: PvcJobCardDefaults | null
}) {
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [poRef, setPoRef] = useState('')
  const [approvalMsg, setApprovalMsg] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [headrailMm, setHeadrailMm] = useState('')
  const [supplyScope, setSupplyScope] = useState<'strips_only' | 'whole_door'>('whole_door')
  const [closureNote, setClosureNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    if (!isManager) return
    fetch('/api/pvc/quotes/meta')
      .then(r => r.json())
      .then(data => {
        if (data.assignees) setAssignees(data.assignees)
      })
      .catch(() => {})
  }, [isManager])

  useEffect(() => {
    if (workflow) {
      setPoRef(workflow.approval_po_reference ?? '')
      setApprovalMsg(workflow.approval_message ?? '')
      if (workflow.job_card_supply_scope === 'strips_only' || workflow.job_card_supply_scope === 'whole_door') {
        setSupplyScope(workflow.job_card_supply_scope)
      }
      if (workflow.job_card_headrail_length_mm != null && workflow.job_card_headrail_length_mm > 0) {
        setHeadrailMm(String(workflow.job_card_headrail_length_mm))
      }
    }
  }, [workflow])

  const isDraftReview = workflow?.workflow_status === 'draft_review'
  const isOnHold = workflow?.workflow_status === 'on_hold'
  const isPreApproval = isPvcPreApprovalStatus(workflow?.workflow_status)

  useEffect(() => {
    if (!isDraftReview || !jobCardDefaults) return
    setSupplyScope(jobCardDefaults.supplyScope)
    setHeadrailMm(
      jobCardDefaults.suggestedHeadrailLengthMm != null
        ? String(jobCardDefaults.suggestedHeadrailLengthMm)
        : '',
    )
  }, [isDraftReview, jobCardDefaults])

  const postWorkflow = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true)
      setErr(null)
      setOk(null)
      try {
        const res = await fetch(`/api/pvc/quotes/${quoteId}/workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Update failed.')
        setOk('Workflow updated.')
        onUpdated?.()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Update failed.')
      } finally {
        setBusy(false)
      }
    },
    [quoteId, onUpdated],
  )

  const printJobCard = () => {
    window.open(`/api/pvc/quotes/${quoteId}/job-card/pdf`, '_blank', 'noopener,noreferrer')
  }

  if (!workflow) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Workflow status unavailable (run database migration for PVC quote workflow).
      </section>
    )
  }

  const status = workflow.workflow_status
  const closed = isPvcWorkflowClosedStatus(status)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Workflow actions</h2>
      {!showStepper ? (
        <p className="mt-1 text-sm text-slate-600">
          Status: <span className="font-medium text-slate-900">{workflowStatusLabel(status)}</span>
          {workflow.invoice_status ? (
            <>
              {' '}
              · <span className="font-medium">{invoiceStatusLabel(workflow.invoice_status)}</span>
            </>
          ) : null}
        </p>
      ) : (
        <div className="mt-3">
          <PVCQuoteWorkflowStepper
            workflowStatus={status}
            invoiceStatus={workflow.invoice_status}
          />
        </div>
      )}

      {workflow.workflow_history.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</h3>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-600">
            {[...workflow.workflow_history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <span className="font-medium text-slate-800">{workflowStatusLabel(h.status)}</span>
                {' · '}
                {String(h.at).slice(0, 16).replace('T', ' ')}
                {h.by_name ? ` · ${h.by_name}` : ''}
                {h.note ? ` — ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'approved' && workflow.assigned_user_name && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Assigned</dt>
            <dd className="font-medium text-slate-900">{workflow.assigned_user_name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Headrail length</dt>
            <dd className="font-medium text-slate-900">
              {workflow.job_card_headrail_length_mm != null && workflow.job_card_headrail_length_mm > 0
                ? `${workflow.job_card_headrail_length_mm} mm`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Supply</dt>
            <dd className="font-medium text-slate-900">{supplyScopeLabel(workflow.job_card_supply_scope)}</dd>
          </div>
          {workflow.approval_po_reference && (
            <div>
              <dt className="text-slate-500">PO / reference</dt>
              <dd className="font-medium text-slate-900">{workflow.approval_po_reference}</dd>
            </div>
          )}
        </dl>
      )}

      {closed && workflow.approval_message ? (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Note: </span>
          {workflow.approval_message}
        </p>
      ) : null}

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-700">{ok}</p>}

      {closed ? (
        <p className="mt-4 text-xs text-slate-500">This quote is closed. Re-open by saving a new quote if needed.</p>
      ) : !isManager ? (
        <p className="mt-4 text-xs text-slate-500">Managers can advance workflow and print job cards.</p>
      ) : (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {isPreApproval && (
            <div className="space-y-3">
              {isOnHold ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  This quote is <span className="font-medium">on hold</span> while the client considers. You can
                  return it to draft, approve, or close it.
                </div>
              ) : null}
              {isOnHold ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => postWorkflow({ action: 'resume_draft' })}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  Return to draft
                </button>
              ) : null}
              <p className="text-sm font-medium text-slate-800">Approve / accepted by client</p>
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
                <span className="text-slate-600">Assign job card to</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {assignees.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">
                  Headrail length (mm)
                  {supplyScope === 'strips_only' ? (
                    <span className="font-normal text-slate-400"> — optional for strips only</span>
                  ) : null}
                </span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  value={headrailMm}
                  onChange={e => setHeadrailMm(e.target.value)}
                  disabled={supplyScope === 'strips_only'}
                  placeholder={supplyScope === 'strips_only' ? 'Not required' : 'From calculator'}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Strips only or whole door</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={supplyScope}
                  onChange={e => {
                    const next = e.target.value as 'strips_only' | 'whole_door'
                    setSupplyScope(next)
                    if (next === 'strips_only') setHeadrailMm('')
                    else if (jobCardDefaults?.suggestedHeadrailLengthMm != null) {
                      setHeadrailMm(String(jobCardDefaults.suggestedHeadrailLengthMm))
                    }
                  }}
                >
                  <option value="whole_door">Whole door</option>
                  <option value="strips_only">Strips only</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const headrailRaw = headrailMm.trim()
                  const headrailNum = headrailRaw ? Number(headrailMm) : null
                  postWorkflow({
                    action: 'approve',
                    approval_po_reference: poRef,
                    approval_message: approvalMsg,
                    assigned_user_id: assigneeId,
                    job_card_headrail_length_mm:
                      supplyScope === 'strips_only' ? null : headrailNum,
                    job_card_supply_scope: supplyScope,
                  })
                }}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Approve & create job card
              </button>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                {!isOnHold ? (
                  <>
                    <p className="text-sm font-medium text-slate-800">Client needs more time?</p>
                    <p className="text-xs text-slate-500">
                      Move to <span className="font-medium">On hold</span> while they decide (stops draft follow-up
                      reminders until you return to draft).
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        postWorkflow({
                          action: 'put_on_hold',
                          closure_note: closureNote,
                        })
                      }
                      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Put on hold
                    </button>
                  </>
                ) : null}

                <p className="text-sm font-medium text-slate-800">Close without approving</p>
                <p className="text-xs text-slate-500">
                  Use <span className="font-medium">Rejected</span> when the client declines the quote. Use{' '}
                  <span className="font-medium">Closed</span> when they are no longer pursuing the job.
                </p>
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
                    onClick={() =>
                      postWorkflow({
                        action: 'reject',
                        closure_note: closureNote,
                      })
                    }
                    className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-60"
                  >
                    Mark rejected
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      postWorkflow({
                        action: 'void',
                        closure_note: closureNote,
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Close — not pursuing
                  </button>
                </div>
              </div>
            </div>
          )}

          {(status === 'approved' || status === 'shipped_or_installed') && (
            <button
              type="button"
              onClick={printJobCard}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Print job card
            </button>
          )}

          {status === 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postWorkflow({ action: 'mark_shipped_or_installed' })}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Mark shipped or installed
            </button>
          )}

          {status === 'shipped_or_installed' && !workflow.invoice_status && (
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
                Not invoiced (email accounts)
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
