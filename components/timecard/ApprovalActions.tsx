'use client'

import { Check, Loader2, X } from 'lucide-react'

type Props = {
  disabled?: boolean
  busyAction?: 'approve' | 'reject' | null
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
}

export function ApprovalActions({ disabled, busyAction, onApprove, onReject }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled || busyAction === 'approve'}
        onClick={() => void onApprove()}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busyAction === 'approve' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
        Approve week
      </button>
      <button
        type="button"
        disabled={disabled || busyAction === 'reject'}
        onClick={() => void onReject()}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busyAction === 'reject' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
        Reject
      </button>
    </div>
  )
}
