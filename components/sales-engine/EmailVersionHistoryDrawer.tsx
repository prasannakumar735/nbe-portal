'use client'

import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

type EmailVersionHistoryDrawerProps = {
  open: boolean
  loading: boolean
  history: SalesGeneratedEmail[]
  onClose: () => void
}

export function EmailVersionHistoryDrawer({
  open,
  loading,
  history,
  onClose,
}: EmailVersionHistoryDrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No versions yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {history.map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">v{row.version}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-700">
                    {row.status}
                  </span>
                </div>
                <p className="mt-2 font-medium text-slate-800">{row.subject}</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-slate-600">{row.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
