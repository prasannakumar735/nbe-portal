'use client'

import type { CampaignGeneratedEmailRow } from '@/lib/sales/review/campaignGeneratedEmailListService'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  edited: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-800',
  queued: 'bg-indigo-100 text-indigo-900',
  sent: 'bg-slate-200 text-slate-800',
}

type GeneratedEmailReviewTableProps = {
  rows: CampaignGeneratedEmailRow[]
  loading: boolean
  busyId: string | null
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onEdit: (row: CampaignGeneratedEmailRow) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRegenerate: (contactId: string) => void
  onHistory: (contactId: string) => void
}

export function GeneratedEmailReviewTable({
  rows,
  loading,
  busyId,
  selectedIds,
  onToggleSelect,
  onEdit,
  onApprove,
  onReject,
  onRegenerate,
  onHistory,
}: GeneratedEmailReviewTableProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Review drafts</h2>
      <p className="mt-1 text-sm text-slate-600">
        Approve only after you are satisfied with each email. Sending is a separate step after
        approval.
      </p>

      {loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Loading drafts…</p>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No generated emails yet. Run AI generation above.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Select</th>
              <th className="px-2 py-2">Contact</th>
              <th className="px-2 py-2">Subject</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Quality</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canReview = row.status === 'draft' || row.status === 'edited'
              const rowBusy = busyId === row.id || busyId === row.contact_id
              return (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggleSelect(row.id)}
                      aria-label={`Select email for ${row.contactEmail ?? row.contact_id}`}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-medium text-slate-900">{row.companyName ?? '—'}</div>
                    <div className="text-xs text-slate-600">{row.contactEmail ?? '—'}</div>
                    <div className="text-xs text-slate-500">v{row.version}</div>
                {row.prompt_name ? (
                  <div className="text-xs text-slate-500">
                    {row.prompt_name} · prompt v{row.prompt_version ?? '—'}
                  </div>
                ) : null}
                  </td>
                  <td className="max-w-xs px-2 py-3 text-slate-800">{row.subject}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[row.status] ?? STATUS_STYLES.draft}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs text-slate-600">
                    {row.quality?.recommendation ?? '—'}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={rowBusy || row.status === 'sent'}
                        onClick={() => onEdit(row)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy || !canReview}
                        onClick={() => onApprove(row.id)}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy || !canReview}
                        onClick={() => onReject(row.id)}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-40"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => onRegenerate(row.contact_id)}
                        className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-40"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => onHistory(row.contact_id)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
