'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { PVCCalculatorClient } from '@/components/pvc/PVCCalculatorClient'
import type { PvcQuoteWorkflowState } from '@/components/pvc/PVCQuoteWorkflowPanel'
import type { PVCCalculatorSnapshotV1 } from '@/lib/pvc/pvcCalculatorSnapshot'

export default function EditPVCCalculatorQuotePage() {
  const params = useParams()
  const quoteId = String(params.quoteId ?? '')
  const [snapshot, setSnapshot] = useState<PVCCalculatorSnapshotV1 | null>(null)
  const [workflow, setWorkflow] = useState<PvcQuoteWorkflowState | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadQuote = useCallback(async () => {
    const r = await fetch(`/api/pvc/quotes/${quoteId}`)
    const data = await r.json()
    if (!r.ok) {
      throw new Error(data.error || 'Failed to load quote.')
    }
    if (!data.snapshot) {
      throw new Error('This quote cannot be edited (no saved calculator data).')
    }
    setSnapshot(data.snapshot as PVCCalculatorSnapshotV1)
    const q = data.quote
    if (q?.workflow_status) {
      setWorkflow({
        workflow_status: q.workflow_status,
        approval_po_reference: q.approval_po_reference ?? null,
        approval_message: q.approval_message ?? null,
        invoice_status: q.invoice_status ?? null,
        assigned_user_name: q.assigned_user_name ?? null,
        job_card_headrail_length_mm: q.job_card_headrail_length_mm ?? null,
        job_card_supply_scope: q.job_card_supply_scope ?? null,
        workflow_history: q.workflow_history ?? [],
      })
    } else {
      setWorkflow(null)
    }
  }, [quoteId])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const meta = await fetch('/api/pvc/quotes/meta')
        const metaData = await meta.json()
        if (!cancel && metaData.isManager) setIsManager(true)
        await loadQuote()
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Failed to load quote.')
      }
    })()
    return () => {
      cancel = true
    }
  }, [loadQuote, reloadKey])

  const handleWorkflowUpdated = () => {
    setReloadKey(k => k + 1)
  }

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-red-600">{err}</p>
        <Link href="/pvc-calculator" className="mt-4 inline-block text-sm text-slate-700 underline">
          Back to saved quotes
        </Link>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  return (
    <PVCCalculatorClient
      mode="edit"
      draftId={quoteId}
      initialSnapshot={snapshot}
      workflow={workflow}
      isManager={isManager}
      onWorkflowUpdated={handleWorkflowUpdated}
    />
  )
}
