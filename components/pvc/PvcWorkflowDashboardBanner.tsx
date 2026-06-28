'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type PendingRow = { id: string; customer_name: string | null; approved_at: string | null }

export function PvcWorkflowDashboardBanner() {
  const [pending, setPending] = useState<PendingRow[]>([])
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    fetch('/api/pvc/quotes/pending-actions')
      .then(r => r.json())
      .then(data => {
        setIsManager(Boolean(data.isManager))
        setPending(data.pendingApprovalFollowUp ?? [])
      })
      .catch(() => {})
  }, [])

  if (!isManager || pending.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">PVC strip quotes — action needed</p>
      <p className="mt-1 text-amber-900">
        {pending.length} approved quote{pending.length === 1 ? '' : 's'} not yet marked shipped or installed.
      </p>
      <ul className="mt-2 list-inside list-disc text-amber-900">
        {pending.slice(0, 5).map(row => (
          <li key={row.id}>
            <Link href={`/pvc-calculator/${row.id}/edit`} className="underline">
              {row.customer_name || 'PVC quote'}
            </Link>
          </li>
        ))}
      </ul>
      {pending.length > 5 ? (
        <Link href="/pvc-calculator" className="mt-2 inline-block text-sm font-medium underline">
          View all PVC quotes
        </Link>
      ) : null}
    </div>
  )
}
