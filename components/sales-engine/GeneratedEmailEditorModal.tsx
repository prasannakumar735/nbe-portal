'use client'

import { useEffect, useState } from 'react'
import { GeneratedEmailAttachmentsPanel } from '@/components/sales-engine/GeneratedEmailAttachmentsPanel'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

type GeneratedEmailEditorModalProps = {
  open: boolean
  email: SalesGeneratedEmail | null
  saving: boolean
  onClose: () => void
  onSave: (subject: string, body: string) => void
}

export function GeneratedEmailEditorModal({
  open,
  email,
  saving,
  onClose,
  onSave,
}: GeneratedEmailEditorModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (email) {
      setSubject(email.subject)
      setBody(email.body)
    }
  }, [email])

  if (!open || !email) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-editor-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="email-editor-title" className="text-lg font-semibold text-slate-900">
            Edit draft
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Subject
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Body
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </label>
        <GeneratedEmailAttachmentsPanel emailId={email.id} />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !subject.trim() || !body.trim()}
            onClick={() => onSave(subject.trim(), body.trim())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
