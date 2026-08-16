'use client'

import type { CampaignGeneratedEmailRow } from '@/lib/sales/review/campaignGeneratedEmailListService'

type QueueApprovedEmailsPanelProps = {
  rows: CampaignGeneratedEmailRow[]
  selectedIds: Set<string>
  busy: boolean
  onBulkApprove: (ids: string[]) => void
  onBulkQueue: (ids: string[]) => void
}

export function QueueApprovedEmailsPanel({
  rows,
  selectedIds,
  busy,
  onBulkApprove,
  onBulkQueue,
}: QueueApprovedEmailsPanelProps) {
  const selectedReviewable = rows
    .filter((r) => selectedIds.has(r.id) && (r.status === 'draft' || r.status === 'edited'))
    .map((r) => r.id)
  const selectedApproved = rows
    .filter((r) => selectedIds.has(r.id) && r.status === 'approved')
    .map((r) => r.id)

  const reviewableIds =
    selectedReviewable.length > 0
      ? selectedReviewable
      : rows.filter((r) => r.status === 'draft' || r.status === 'edited').map((r) => r.id)
  const approvedIds =
    selectedApproved.length > 0
      ? selectedApproved
      : rows.filter((r) => r.status === 'approved').map((r) => r.id)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Approve &amp; queue</h2>
      <p className="mt-1 text-sm text-slate-600">
        Step 1: approve reviewed drafts. Step 2: queue approved emails for send (Microsoft Graph).
        Nothing is sent automatically from this screen.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || reviewableIds.length === 0}
          onClick={() => onBulkApprove(reviewableIds)}
          className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50"
        >
          Approve all reviewable ({reviewableIds.length})
        </button>
        <button
          type="button"
          disabled={busy || approvedIds.length === 0}
          onClick={() => onBulkQueue(approvedIds)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Queue approved for send ({approvedIds.length})
        </button>
      </div>
    </section>
  )
}
